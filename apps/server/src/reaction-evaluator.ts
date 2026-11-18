import {
  splitAizuchiReaction,
  isKnownAizuchi,
  isImmediateAizuchi,
} from "./aizuchi-splitter.js";
import { memoizeAsync } from "./memoize-async.js";
import { resolve } from "node:path";
import {
  reactionLevelSchema,
  type ReactionLevel,
  type ReactionDecision,
  type ReactionSegment,
} from "@gaya/shared";

type Pair = { source: string; reaction: string; userNames?: readonly string[] };
type Evaluate = (pair: Pair) => Promise<{ level: unknown }>;
export type EvaluatorState = "idle" | "loading" | "ready" | "error";
export class EvaluatorBusyError extends Error {}

/** One model instance, one inference at a time. Text is never persisted or logged. */
export class ReactionEvaluator {
  state: EvaluatorState = "idle";
  private loading: Promise<void> | undefined;
  private evaluatePair: Evaluate | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  constructor(
    private readonly load: () => Promise<Evaluate> = loadEvaluator,
    private readonly split: (
      text: string,
    ) => Promise<string[] | null> = splitAizuchiReaction,
  ) {}
  async classify(pair: Pair, signal?: AbortSignal): Promise<ReactionDecision> {
    signal?.throwIfAborted();
    const parts = await this.split(pair.reaction);
    if (!parts || parts.length < 2) {
      const level = isImmediateAizuchi(pair.reaction)
        ? "短い相槌"
        : await this.evaluate(pair, signal);
      return {
        level,
        ...(level === "短い相槌" && (await isKnownAizuchi(pair.reaction))
          ? { streamable: true }
          : {}),
      };
    }
    const segments: ReactionSegment[] = [];
    for (const text of parts)
      segments.push({
        text,
        level: isImmediateAizuchi(text)
          ? "短い相槌"
          : await this.evaluate({ ...pair, reaction: text }, signal),
      });
    // level stays for older clients; current clients always consume each segment independently.
    return {
      level: segments[0]!.level,
      segments,
      ...(segments.every((part) => part.level === "短い相槌")
        ? { streamable: true }
        : {}),
    };
  }
  prepare(): Promise<void> {
    if (this.loading) return this.loading;
    this.state = "loading";
    this.loading = this.load()
      .then((evaluate) => {
        this.evaluatePair = evaluate;
        this.state = "ready";
      })
      .catch((error: unknown) => {
        this.state = "error";
        this.loading = undefined;
        throw error;
      });
    return this.loading;
  }
  evaluate(pair: Pair, signal?: AbortSignal): Promise<ReactionLevel> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    // User-specified override: a participant's name always takes priority over the model.
    const canonicalName = (value: string) =>
      value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[ァ-ヶ]/gu, (c) =>
          String.fromCharCode(c.charCodeAt(0) - 0x60),
        );
    const text = canonicalName(pair.reaction);
    if (
      pair.userNames?.some((name) => {
        const normalized = canonicalName(name);
        return normalized.length > 0 && text.includes(normalized);
      })
    )
      return Promise.resolve("短い相槌");
    if (this.pending >= 8) return Promise.reject(new EvaluatorBusyError());
    this.pending++;
    const task = this.tail
      .catch(() => {})
      .then(async () => {
        signal?.throwIfAborted();
        await this.prepare();
        signal?.throwIfAborted();
        const result = await this.evaluatePair!({
          source: pair.source,
          reaction: pair.reaction,
        });
        signal?.throwIfAborted();
        return reactionLevelSchema.parse(result.level);
      })
      .finally(() => {
        this.pending--;
      });
    this.tail = task.then(
      () => {},
      () => {},
    );
    return task;
  }
}
async function loadEvaluator(): Promise<Evaluate> {
  const { initProximity, initExampleModels, evaluate } =
    await import("reaction-evaluator");
  // The library picks the model (Ruri v3 30m q8, D-088); keep its thresholds as supplied.
  const analyzer = await initProximity({
    cacheDir: process.env.MODEL_CACHE_DIR ?? resolve(".cache/reaction-models"),
  });
  // Both learned features request the same embedding. Share that work without changing scores.
  const embed = analyzer.embed.bind(analyzer);
  analyzer.embed = memoizeAsync(embed, 128, 60_000);
  await initExampleModels();
  await splitAizuchiReaction("");
  await analyzer.embed("なるほど"); // Warm the first inference before live speech reaches the classifier.
  const cached = memoizeAsync(
    async (key) => {
      const [source, reaction] = JSON.parse(key) as [string, string];
      return evaluate({ source, reaction });
    },
    64,
    30_000,
  );
  return (pair) => cached(JSON.stringify([pair.source, pair.reaction]));
}
