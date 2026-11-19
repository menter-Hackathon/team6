import {
  splitAizuchiReaction,
  isKnownAizuchi,
  isImmediateAizuchi,
} from "./aizuchi-splitter.js";
import { memoizeAsync } from "./memoize-async.js";
import { resolve } from "node:path";
import { Worker, parentPort, workerData } from "node:worker_threads";
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
    private readonly load: () => Promise<Evaluate> = loadInWorker,
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
    // User-specified override: a standalone call to a participant is an aizuchi.
    const canonicalName = (value: string) =>
      value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[ァ-ヶ]/gu, (c) =>
          String.fromCharCode(c.charCodeAt(0) - 0x60),
        );
    const text = canonicalName(pair.reaction);
    const call = text.replace(/[!?。、,.…]+$/u, "").trimEnd();
    if (call === "えっ") return Promise.resolve("短い相槌");
    if (
      pair.userNames?.some((name) => {
        const normalized = canonicalName(name);
        return (
          normalized.length > 0 &&
          (text === normalized ||
            ["", "さん", "くん", "君", "ちゃん", "先輩"].some(
              (suffix) => call === normalized + suffix,
            ))
        );
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
        let result: Awaited<ReturnType<Evaluate>>;
        try {
          result = await this.evaluatePair!({
            source: pair.source,
            reaction: pair.reaction,
          });
        } catch (error) {
          if (error instanceof ReactionWorkerExitError) {
            this.state = "error";
            this.loading = undefined;
            this.evaluatePair = undefined;
          }
          throw error;
        }
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

class ReactionWorkerExitError extends Error {}

async function loadInWorker(): Promise<Evaluate> {
  const worker = import.meta.url.endsWith(".ts")
    ? new Worker(
        `const { tsImport } = await import(${JSON.stringify(import.meta.resolve("tsx/esm/api"))});
         await tsImport(${JSON.stringify(import.meta.url)}, import.meta.url);`,
        { eval: true, workerData: "reaction-model", execArgv: [] },
      )
    : new Worker(new URL(import.meta.url), { workerData: "reaction-model" });

  type Reply = { ok: true; level?: unknown } | { ok: false };
  let failed = false;
  let receive: ((reply: Reply) => void) | undefined;
  let rejectPending: ((error: Error) => void) | undefined;
  const fail = () => {
    failed = true;
    rejectPending?.(new ReactionWorkerExitError("Reaction worker exited"));
  };
  worker.on("error", fail);
  worker.on("exit", fail);
  worker.on("message", (reply: Reply) => receive?.(reply));

  // The evaluator queues calls, so the worker has at most one outstanding reply.
  const request = (pair?: Pair): Promise<Reply> =>
    new Promise((accept, reject) => {
      if (failed) {
        reject(new ReactionWorkerExitError("Reaction worker exited"));
        return;
      }
      worker.ref();
      const clear = () => {
        receive = undefined;
        rejectPending = undefined;
        worker.unref();
      };
      receive = (reply) => {
        clear();
        accept(reply);
      };
      rejectPending = (error) => {
        clear();
        reject(error);
      };
      if (pair) worker.postMessage(pair);
    });

  try {
    if (!(await request()).ok) throw new Error("Reaction model unavailable");
  } catch (error) {
    void worker.terminate();
    throw error;
  }

  return async (pair) => {
    const reply = await request(pair);
    if (!reply.ok) throw new Error("Reaction inference failed");
    return { level: reply.level };
  };
}

if (workerData === "reaction-model" && parentPort) {
  const port = parentPort;
  void loadEvaluator().then(
    (evaluate) => {
      port.on("message", async (pair: Pair) => {
        try {
          const { level } = await evaluate(pair);
          port.postMessage({ ok: true, level });
        } catch {
          port.postMessage({ ok: false });
        }
      });
      port.postMessage({ ok: true });
    },
    () => port.postMessage({ ok: false }),
  );
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
      const decision = await evaluate({ source, reaction });
      if (
        !source.trim() ||
        decision.level === "除外" ||
        decision.rule === "短い相槌:相槌のセット"
      )
        return decision;

      // Stock phrases have no relevance judgment. Content uses the same
      // thresholds the library already applies to long reactions.
      const relevance = decision.judgments.relatesToSource;
      if (relevance === "no") return { level: "除外" };
      if (relevance === "unsure") return { level: "迷い" };
      return decision;
    },
    64,
    30_000,
  );
  return (pair) => cached(JSON.stringify([pair.source, pair.reaction]));
}
