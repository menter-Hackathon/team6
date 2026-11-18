import { expect, it } from "vitest";
import { AizuchiStream, immediateAizuchiText } from "./aizuchi-stream";
import type { ReactionDecision } from "@gaya/shared";
const decision = (...words: string[]): ReactionDecision => ({
  level: "短い相槌",
  streamable: true,
  ...(words.length > 1
    ? { segments: words.map((text) => ({ text, level: "短い相槌" as const })) }
    : {}),
});
it("emits the first hai immediately and only new units in successive interim results", () => {
  const stream = new AizuchiStream();
  const first = stream.preview("a")!;
  expect(stream.commit("a", first, "はい", decision("はい"))).toEqual([
    { text: "はい", level: "短い相槌" },
  ]);
  const next = stream.preview("a")!;
  expect(
    stream.commit(
      "a",
      next,
      "はいはいはいはい",
      decision("はい", "はい", "はい", "はい"),
    ),
  ).toHaveLength(3);
  expect(
    stream.commit(
      "a",
      next,
      "はいはいはいはい",
      decision("はい", "はい", "はい", "はい"),
    ),
  ).toEqual([]);
  expect(stream.seal("a", "はいはいはいはい。")).toEqual({
    parts: Array.from({ length: 4 }, () => ({
      text: "はい",
      level: "短い相槌",
    })),
    remaining: "",
  });
  expect(stream.preview("a")).toBeNull();
  expect(
    stream.commit(
      "a",
      next,
      "はいはいはいはいはい",
      decision("はい", "はい", "はい", "はい", "はい"),
    ),
  ).toEqual([]);
});
it("emits each naruhodo and carries the unspoken sentence tail into final classification", () => {
  const stream = new AizuchiStream();
  const first = stream.preview("a")!;
  stream.commit("a", first, "なるほど", decision("なるほど"));
  const next = stream.preview("a")!;
  expect(
    stream.commit(
      "a",
      next,
      "なるほどなるほど",
      decision("なるほど", "なるほど"),
    ),
  ).toHaveLength(1);
  expect(
    stream.seal("a", "ナルホド、なるほど。僕もそこに行きました").remaining,
  ).toBe("僕もそこに行きました");
});
it("ignores stale, non-streamable, excluded and revised-prefix decisions", () => {
  const stream = new AizuchiStream();
  const stale = stream.preview("a")!;
  const current = stream.preview("a")!;
  expect(stream.commit("a", stale, "はい", decision("はい"))).toEqual([]);
  expect(stream.commit("a", current, "悪口", { level: "除外" })).toEqual([]);
  expect(
    stream.commit("a", current, "文章", {
      level: "長い文章",
      streamable: true,
    }),
  ).toEqual([]);
  stream.commit("a", current, "はい", decision("はい"));
  const revised = stream.preview("a")!;
  expect(
    stream.commit(
      "a",
      revised,
      "なるほどなるほど",
      decision("なるほど", "なるほど"),
    ),
  ).toEqual([]);
  expect(stream.seal("a", "違う文章").remaining).toBe("違う文章");
});
it("keeps utterances independent and releases data on close", () => {
  const stream = new AizuchiStream();
  stream.commit("a", stream.preview("a")!, "はい", decision("はい"));
  expect(stream.seal("b", "はい")).toEqual({ parts: [], remaining: "はい" });
  stream.clear();
  expect(stream.emitted("a")).toEqual([]);
});
it("chooses the fastest path only for complete common words", () => {
  expect(immediateAizuchiText("ハイ、はいはい！")).toBe(true);
  expect(immediateAizuchiText("なるほどなるほど")).toBe(true);
  expect(immediateAizuchiText("なるほ")).toBe(false);
  expect(immediateAizuchiText("はい、違うよ")).toBe(false);
});
