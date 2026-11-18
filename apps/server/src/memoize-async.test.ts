import { afterEach, expect, it, vi } from "vitest";
import { memoizeAsync } from "./memoize-async.js";
afterEach(() => vi.useRealTimers());
it("shares identical simultaneous embeddings and cached results, but keeps text distinct", async () => {
  const run = vi.fn(async (text: string) => [text.length]);
  const cached = memoizeAsync(run, 2, 1000);
  const first = cached("なるほど"),
    second = cached("なるほど");
  expect(first).toBe(second);
  await Promise.all([first, second, cached("すごい")]);
  await cached("なるほど");
  expect(run).toHaveBeenCalledTimes(2);
});
it("expires old results, bounds memory, and allows retry after failure", async () => {
  vi.useFakeTimers();
  const run = vi.fn(async () => 1);
  const cached = memoizeAsync(run, 1, 1000);
  await cached("a");
  await cached("b");
  await cached("a");
  expect(run).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(1001);
  await cached("a");
  expect(run).toHaveBeenCalledTimes(4);
  const failing = vi
    .fn()
    .mockRejectedValueOnce(new Error("temporary"))
    .mockResolvedValue(2);
  const retried = memoizeAsync(failing, 1, 1000);
  await expect(retried("a")).rejects.toThrow("temporary");
  await expect(retried("a")).resolves.toBe(2);
});
