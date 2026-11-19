import { describe, expect, it } from "vitest";
import { splitUtterance } from "./split-utterance";

describe("splitUtterance", () => {
  it("cuts at Chrome's pause spaces between Japanese words, not around English words", () => {
    expect(
      splitUtterance(
        "液体感を出そうと AI と格闘した結果 一応 AI で開発しなさい って書いてたけど最後 地味に使って自分でその",
      ),
    ).toEqual([
      "液体感を出そうと AI と格闘した結果",
      "一応 AI で開発しなさい",
      "って書いてたけど最後",
      "地味に使って自分でその",
    ]);
  });
  it("cuts after sentence-ending punctuation, keeping repeated marks together", () => {
    expect(
      splitUtterance("それは大変だったね。どこで落としたの？！ 見つかった？"),
    ).toEqual(["それは大変だったね。", "どこで落としたの？！", "見つかった？"]);
  });
  it("leaves a single phrase and Latin-only text alone", () => {
    expect(splitUtterance("なるほど")).toEqual(["なるほど"]);
    expect(splitUtterance("Thank you very much")).toEqual([
      "Thank you very much",
    ]);
    expect(splitUtterance("OK です")).toEqual(["OK です"]);
  });
  it("ignores extra whitespace and returns nothing for blank input", () => {
    expect(splitUtterance("  うん   はい  ")).toEqual(["うん", "はい"]);
    expect(splitUtterance("   ")).toEqual([]);
  });
  it("treats adjacent hai fragments as a single utterance", () => {
    expect(splitUtterance("はい！ ハイ はい、はい。 確かに！")).toEqual([
      "はい！ハイはい、はい。",
      "確かに！",
    ]);
  });
});
