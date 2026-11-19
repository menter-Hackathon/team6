import { reactionResponseSchema, type ReactionDecision } from "@gaya/shared";
export interface ReactionInput {
  reaction: string;
  source: string;
  userNames: string[];
  roomId?: string | undefined;
  turnIndex?: number | undefined;
}
type Evaluate = (
  pair: ReactionInput,
  signal: AbortSignal,
) => Promise<ReactionDecision>;
interface Entry {
  key: string;
  promise: Promise<ReactionDecision>;
  controller: AbortController;
  expires: number;
  final: boolean;
}

/** Shares interim/final decisions; callers decide which confirmed aizuchi units to emit. */
export class ReactionClient {
  private readonly cache = new Map<string, Entry>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private preview: Entry | undefined;
  constructor(private readonly run: Evaluate) {}
  prefetch(
    pair: ReactionInput | null,
    options: {
      delayMs?: number;
      onResult?: (decision: ReactionDecision) => void;
    } = {},
  ) {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!pair?.reaction.trim()) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const key = JSON.stringify(pair);
      if (this.preview && this.preview.key !== key && !this.preview.final) {
        this.preview.controller.abort();
        if (this.cache.get(this.preview.key) === this.preview)
          this.cache.delete(this.preview.key);
      }
      this.preview = this.get(pair);
      void this.preview.promise
        .then((decision) => options.onResult?.(decision))
        .catch(() => {});
    }, options.delayMs ?? 180);
  }
  evaluate(
    pair: ReactionInput,
    signal: AbortSignal,
  ): Promise<ReactionDecision> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (signal.aborted) return Promise.reject(signal.reason);
    const entry = this.get(pair);
    entry.final = true;
    if (this.preview && this.preview !== entry && !this.preview.final) {
      this.preview.controller.abort();
      if (this.cache.get(this.preview.key) === this.preview)
        this.cache.delete(this.preview.key);
    }
    const abort = () => {
      entry.controller.abort();
      this.cache.delete(entry.key);
    };
    signal.addEventListener("abort", abort, { once: true });
    return entry.promise
      .then((level) => {
        signal.throwIfAborted();
        return level;
      })
      .finally(() => signal.removeEventListener("abort", abort));
  }
  private get(pair: ReactionInput): Entry {
    const now = Date.now(),
      key = JSON.stringify(pair);
    for (const [oldKey, entry] of this.cache)
      if (entry.expires <= now) this.cache.delete(oldKey);
    const cached = this.cache.get(key);
    if (cached && !cached.controller.signal.aborted) return cached;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    const entry: Entry = {
      key,
      controller,
      expires: Infinity,
      final: false,
      promise: Promise.resolve()
        .then(() => this.run(pair, controller.signal))
        .then((level) => {
          entry.expires = Date.now() + 10_000;
          return level;
        })
        .finally(() => clearTimeout(timeout)),
    };
    this.cache.set(key, entry);
    while (this.cache.size > 16)
      this.cache.delete(this.cache.keys().next().value!);
    void entry.promise.catch(() => {
      if (this.cache.get(key) === entry) this.cache.delete(key);
    });
    return entry;
  }
  clear() {
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const entry of this.cache.values()) entry.controller.abort();
    this.cache.clear();
    this.preview = undefined;
  }
}
export function createReactionClient(api: string) {
  return new ReactionClient(async (pair, signal) => {
    const response = await fetch(`${api}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pair),
      signal,
    });
    if (response.status === 409) throw new Error("turn-changed");
    if (!response.ok)
      throw new Error(response.status === 429 ? "busy" : "unavailable");
    return reactionResponseSchema.parse(await response.json());
  });
}
