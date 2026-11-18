import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReactionClient, type ReactionInput } from "./reaction-client";
const pair: ReactionInput = {
  reaction: "なるほど",
  source: "元の話",
  userNames: ["太郎"],
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("debounces evolving interim text, and reuses an identical final result without another request", async () => {
  const run = vi.fn(async () => ({ level: "短い相槌" as const }));
  const client = new ReactionClient(run);
  client.prefetch({ ...pair, reaction: "なる" });
  vi.advanceTimersByTime(100);
  client.prefetch(pair);
  vi.advanceTimersByTime(179);
  expect(run).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledOnce();
  await expect(
    client.evaluate(pair, new AbortController().signal),
  ).resolves.toEqual({ level: "短い相槌" });
  expect(run).toHaveBeenCalledOnce();
  client.clear();
});
it("does not reuse a preview when the final text, context, or username list changed", async () => {
  const run = vi.fn(async () => ({ level: "迷い" as const })),
    client = new ReactionClient(run);
  client.prefetch(pair);
  await vi.advanceTimersByTimeAsync(180);
  for (const change of [
    { reaction: "その店どこ？" },
    { source: "違う話" },
    { userNames: ["花子"] },
  ])
    await client.evaluate({ ...pair, ...change }, new AbortController().signal);
  expect(run).toHaveBeenCalledTimes(4);
  client.clear();
});
it("never starts a pending preview after closing, and aborts work already started", async () => {
  const signals: AbortSignal[] = [];
  const run = vi.fn(async (_pair: ReactionInput, signal: AbortSignal) => {
    signals.push(signal);
    return { level: "除外" as const };
  });
  const client = new ReactionClient(run);
  client.prefetch(pair);
  client.clear();
  await vi.advanceTimersByTimeAsync(200);
  expect(run).not.toHaveBeenCalled();
  client.prefetch(pair);
  await vi.advanceTimersByTimeAsync(180);
  client.clear();
  expect(signals[0]!.aborted).toBe(true);
});
it("retries failed speculation and does not abort a final when interim text is cleared", async () => {
  const run = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ level: "短い相槌" });
  const client = new ReactionClient(run);
  client.prefetch(pair);
  await vi.advanceTimersByTimeAsync(180);
  const controller = new AbortController();
  const result = client.evaluate(pair, controller.signal);
  client.prefetch(null);
  await expect(result).resolves.toEqual({ level: "短い相槌" });
  expect(run).toHaveBeenCalledTimes(2);
  client.clear();
});

it("rejects a cancelled final even if the transport finishes late", async () => {
  let release!: (level: { level: "短い相槌" }) => void;
  const client = new ReactionClient(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const controller = new AbortController();
  const pending = client.evaluate(pair, controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  await Promise.resolve();
  controller.abort();
  release({ level: "短い相槌" });
  await rejected;
  client.clear();
});

it("reuses all precomputed segment decisions while preserving their independent levels", async () => {
  const decision = {
    level: "短い相槌" as const,
    segments: [
      { text: "なるほど", level: "短い相槌" as const },
      { text: "あー", level: "除外" as const },
    ],
  };
  const run = vi.fn(async () => decision),
    client = new ReactionClient(run);
  client.prefetch(pair);
  await vi.advanceTimersByTimeAsync(180);
  await expect(
    client.evaluate(pair, new AbortController().signal),
  ).resolves.toEqual(decision);
  expect(run).toHaveBeenCalledOnce();
  client.clear();
});

it("returns common interim decisions immediately without waiting for finalization", async () => {
  const decision = { level: "短い相槌" as const, streamable: true };
  const run = vi.fn(async () => decision),
    onResult = vi.fn();
  const client = new ReactionClient(run);
  client.prefetch(pair, { delayMs: 0, onResult });
  await vi.advanceTimersByTimeAsync(0);
  expect(onResult).toHaveBeenCalledWith(decision);
  await expect(
    client.evaluate(pair, new AbortController().signal),
  ).resolves.toEqual(decision);
  expect(run).toHaveBeenCalledOnce();
  client.clear();
});
