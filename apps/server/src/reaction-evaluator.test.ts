import { expect, it, vi } from "vitest";
import { ReactionEvaluator, EvaluatorBusyError } from "./reaction-evaluator.js";
const pair = { source: "昨日の話", reaction: "なるほど" };
it("initializes once, serializes inferences, and returns only recognized levels", async () => {
  let running = 0,
    max = 0;
  const evaluate = vi.fn(async () => {
    max = Math.max(max, ++running);
    await Promise.resolve();
    running--;
    return { level: "短い相槌" };
  });
  const load = vi.fn(async () => evaluate);
  const evaluator = new ReactionEvaluator(load);
  expect(evaluator.state).toBe("idle");
  await Promise.all([evaluator.prepare(), evaluator.prepare()]);
  expect(evaluator.state).toBe("ready");
  expect(
    await Promise.all([evaluator.evaluate(pair), evaluator.evaluate(pair)]),
  ).toEqual(["短い相槌", "短い相槌"]);
  expect(load).toHaveBeenCalledOnce();
  expect(max).toBe(1);
  expect(evaluate).toHaveBeenCalledWith(pair);
});
it("retries failed initialization without inventing a default classification", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("missing model"))
    .mockResolvedValue(async () => ({ level: "除外" }));
  const evaluator = new ReactionEvaluator(load);
  await expect(evaluator.evaluate(pair)).rejects.toThrow("missing model");
  expect(evaluator.state).toBe("error");
  await expect(evaluator.evaluate(pair)).resolves.toBe("除外");
  expect(load).toHaveBeenCalledTimes(2);
});
it("rejects unknown library output, then continues serving later requests", async () => {
  const evaluate = vi
    .fn()
    .mockResolvedValueOnce({ level: "invalid" })
    .mockResolvedValue({ level: "迷い" });
  const evaluator = new ReactionEvaluator(async () => evaluate);
  await expect(evaluator.evaluate(pair)).rejects.toThrow();
  await expect(evaluator.evaluate(pair)).resolves.toBe("迷い");
});
it("bounds pending work and skips abandoned queued requests", async () => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const evaluate = vi.fn(async () => ({ level: "長い文章" }));
  const evaluator = new ReactionEvaluator(async () => {
    await ready;
    return evaluate;
  });
  const abort = new AbortController();
  const jobs = [evaluator.evaluate(pair)];
  const cancelled = evaluator.evaluate(pair, abort.signal);
  const checkCancelled = expect(cancelled).rejects.toThrow();
  for (let i = 0; i < 6; i++) jobs.push(evaluator.evaluate(pair));
  await expect(evaluator.evaluate(pair)).rejects.toBeInstanceOf(
    EvaluatorBusyError,
  );
  abort.abort();
  release();
  await Promise.all(jobs);
  await checkCancelled;
  expect(evaluate).toHaveBeenCalledTimes(7);
});

it("treats an embedded username as aizuchi before exclusions, length checks or model loading", async () => {
  const model = vi.fn(async () => ({ level: "除外" }));
  const load = vi.fn(async () => model);
  const evaluator = new ReactionEvaluator(load);
  await expect(
    evaluator.evaluate({
      source: "",
      reaction: "太郎さん、それはとても大変だったね",
      userNames: ["花子", "太郎"],
    }),
  ).resolves.toBe("短い相槌");
  expect(load).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
  expect(evaluator.state).toBe("idle");
  await expect(
    evaluator.evaluate({
      source: "",
      reaction: "ラグい",
      userNames: ["花子", "太郎"],
    }),
  ).resolves.toBe("除外");
  expect(model).toHaveBeenCalledWith({ source: "", reaction: "ラグい" });
});
it("matches full-width and mixed-case usernames literally, including punctuation", async () => {
  const load = vi.fn(async () => async () => ({ level: "迷い" }));
  const evaluator = new ReactionEvaluator(load);
  for (const [reaction, name] of [
    ["ＡＬＩＣＥさんすごい", "Alice"],
    ["alice、なるほど", "Ａｌｉｃｅ"],
    ["a.bさん", "a.b"],
  ])
    await expect(
      evaluator.evaluate({
        source: "",
        reaction: reaction!,
        userNames: [name!],
      }),
    ).resolves.toBe("短い相槌");
  expect(load).not.toHaveBeenCalled();
  await expect(
    evaluator.evaluate({ source: "", reaction: "axbさん", userNames: ["a.b"] }),
  ).resolves.toBe("迷い");
});
it("uses only the current reaction and name list, and ignores blank names", async () => {
  const evaluate = vi.fn(async () => ({ level: "長い文章" }));
  const evaluator = new ReactionEvaluator(async () => evaluate);
  await expect(
    evaluator.evaluate({
      source: "太郎の話",
      reaction: "それはとても大変だったね",
      userNames: ["太郎", " "],
    }),
  ).resolves.toBe("長い文章");
  await expect(
    evaluator.evaluate({
      source: "",
      reaction: "太郎さん、それは大変だったね",
      userNames: [],
    }),
  ).resolves.toBe("長い文章");
  expect(evaluate).toHaveBeenCalledTimes(2);
});
it("does not classify a cancelled request even when it contains a username", async () => {
  const load = vi.fn();
  const evaluator = new ReactionEvaluator(load);
  const controller = new AbortController();
  controller.abort();
  await expect(
    evaluator.evaluate(
      { source: "", reaction: "太郎さん", userNames: ["太郎"] },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(load).not.toHaveBeenCalled();
});
