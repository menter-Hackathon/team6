import { expect, it, vi } from "vitest";
import { splitAizuchiReaction } from "./aizuchi-splitter.js";
import { ReactionEvaluator } from "./reaction-evaluator.js";
it("uses the supplied dictionary to split separated and concatenated aizuchi", async () => {
  await expect(splitAizuchiReaction("すげえ、マジか天才")).resolves.toEqual([
    "すげえ",
    "まじか",
    "天才",
  ]);
  await expect(splitAizuchiReaction("へーなるほど")).resolves.toEqual([
    "へー",
    "なるほど",
  ]);
  await expect(splitAizuchiReaction("なるほど")).resolves.toBeNull();
  await expect(splitAizuchiReaction("それは大変だったね")).resolves.toBeNull();
});
it("judges each part independently, including usernames and exclusions", async () => {
  const evaluate = vi.fn(
    async ({ reaction }: { reaction: string; source: string }) => ({
      level: reaction === "ラグい" ? "除外" : "短い相槌",
    }),
  );
  const split = vi.fn(async () => ["すげえ", "タロウ", "ラグい"]);
  const evaluator = new ReactionEvaluator(async () => evaluate, split);
  await expect(
    evaluator.classify({
      reaction: "すげえ、タロウ、ラグい",
      source: "元の話",
      userNames: ["たろう"],
    }),
  ).resolves.toEqual({
    level: "短い相槌",
    segments: [
      { text: "すげえ", level: "短い相槌" },
      { text: "タロウ", level: "短い相槌" },
      { text: "ラグい", level: "除外" },
    ],
  });
  expect(evaluate.mock.calls.map(([pair]) => pair)).toEqual([
    { reaction: "すげえ", source: "元の話" },
    { reaction: "ラグい", source: "元の話" },
  ]);
});
it("keeps ordinary sentences as one result instead of splitting on punctuation alone", async () => {
  const evaluator = new ReactionEvaluator(async () => async () => ({
    level: "長い文章",
  }));
  await expect(
    evaluator.classify({
      source: "",
      reaction: "なるほど、僕も昨日そこに行ったよ",
    }),
  ).resolves.toEqual({ level: "長い文章" });
});

it("splits every repeated hai and naruhodo, even if the repeated form is a dictionary entry", async () => {
  await expect(splitAizuchiReaction("はいはいはいはい")).resolves.toEqual([
    "はい",
    "はい",
    "はい",
    "はい",
  ]);
  await expect(splitAizuchiReaction("なるほどなるほど")).resolves.toEqual([
    "なるほど",
    "なるほど",
  ]);
  await expect(
    splitAizuchiReaction("はいはい、なるほどなるほど"),
  ).resolves.toEqual(["はい", "はい", "なるほど", "なるほど"]);
});
it("classifies repeated common aizuchi immediately without model preparation", async () => {
  const load = vi.fn(async () => {
    throw new Error("not needed");
  });
  const evaluator = new ReactionEvaluator(load);
  await expect(
    evaluator.classify({
      source: "",
      reaction: "なるほどなるほどなるほどなるほど",
    }),
  ).resolves.toEqual({
    level: "短い相槌",
    streamable: true,
    segments: Array.from({ length: 4 }, () => ({
      text: "なるほど",
      level: "短い相槌",
    })),
  });
  expect(load).not.toHaveBeenCalled();
});

it("recognizes fixed standalone aizuchi, including transcription variants", async () => {
  const evaluate = vi.fn(async () => ({ level: "除外" }));
  const evaluator = new ReactionEvaluator(async () => evaluate);
  const source = "旅行先で財布をなくした";
  for (const reaction of [
    "なになに？",
    "ナニナニ",
    "何々？",
    "何何",
    "確かに！",
    "たしかに",
    "流石！",
    "さすが",
    "知らなかった",
    "しらなかった",
    "すごい",
    "凄い",
    "センスある",
    "そうなんだ",
  ]) {
    await expect(evaluator.classify({ source, reaction })).resolves.toEqual({
      level: "短い相槌",
      streamable: true,
    });
  }
  expect(evaluate).not.toHaveBeenCalled();
  await expect(
    evaluator.classify({ source, reaction: "確かに明日のバイトは忙しい" }),
  ).resolves.toEqual({ level: "除外" });
  expect(evaluate).toHaveBeenCalledOnce();
});

it("groups repeated hai into one final short aizuchi", async () => {
  const evaluator = new ReactionEvaluator();
  for (const reaction of ["はい！", "はい、はい、はい", "ハイハイ"]) {
    await expect(evaluator.classify({ source: "", reaction })).resolves.toEqual(
      { level: "短い相槌" },
    );
  }
  await expect(
    evaluator.classify({ source: "", reaction: "はいはい、なるほど" }),
  ).resolves.toEqual({
    level: "短い相槌",
    segments: [
      { text: "はいはい", level: "短い相槌" },
      { text: "なるほど", level: "短い相槌" },
    ],
  });
});
