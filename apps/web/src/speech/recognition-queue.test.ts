import { expect, it } from "vitest";
import { RecognitionQueue, type RecognitionJob } from "./recognition-queue";
const job = (
  id: string,
  utteranceId: string,
  final = false,
): RecognitionJob => ({
  id,
  utteranceId,
  final,
  audio: new Float32Array([0.1, 0.2]),
  durationMs: 1,
});
it("replaces stale draft audio instead of building a backlog", () => {
  const queue = new RecognitionQueue(),
    a = job("a", "u"),
    b = job("b", "u"),
    c = job("c", "u");
  queue.add(a);
  expect(queue.next()).toBe(a);
  queue.add(b);
  queue.add(c);
  expect(Array.from(b.audio)).toEqual([0, 0]);
  expect(queue.size).toBe(2);
  queue.finish("a");
  expect(queue.next()).toBe(c);
});
it("prioritizes a final result over previews and rejects a late preview for that utterance", () => {
  const queue = new RecognitionQueue(),
    draft = job("draft", "u"),
    final = job("final", "u", true),
    newer = job("new", "v");
  queue.add(draft);
  queue.add(final);
  expect(queue.add(job("stale", "u"))).toBe(false);
  queue.add(newer);
  expect(queue.next()).toBe(final);
  queue.finish("wrong");
  expect(queue.active).toBe(final);
  queue.finish("final");
  expect(queue.next()).toBe(newer);
});
it("bounds final work and releases queued audio on reset", () => {
  const queue = new RecognitionQueue();
  const jobs = [0, 1, 2, 3].map((n) => job(String(n), String(n), true));
  expect(jobs.map((j) => queue.add(j))).toEqual([true, true, true, false]);
  expect(Array.from(jobs[3]!.audio)).toEqual([0, 0]);
  queue.clear();
  expect(queue.size).toBe(0);
  expect(Array.from(jobs[0]!.audio)).toEqual([0, 0]);
});
