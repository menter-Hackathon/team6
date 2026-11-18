import { describe, it, expect } from "vitest";
import {
  REACTION_LEVELS,
  reactionDrops,
  reactionForKey,
  reactionPaintKind,
} from "./reaction-preview";
import { InkEffects } from "./ink-effects";

describe("five reaction previews", () => {
  it("keeps 1–5 in category order and F as a reply alias", () => {
    expect(
      ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].map(reactionForKey),
    ).toEqual(REACTION_LEVELS);
    expect(reactionForKey("Numpad1")).toBe("返答");
    expect(reactionForKey("KeyF")).toBe("返答");
    expect(reactionForKey("KeyA")).toBeUndefined();
  });
  it("keeps the five Japanese API levels and produces no drops for exclusion", () => {
    expect(REACTION_LEVELS).toEqual([
      "返答",
      "反応的な相槌",
      "相槌",
      "その他",
      "除外",
    ]);
    expect(REACTION_LEVELS.map((level) => reactionDrops(level).length)).toEqual(
      [0, 5, 0, 1, 0],
    );
  });
  it("uses the enlarged fan for 2 and the exact standard paint kind for 3", () => {
    const fan = reactionDrops("反応的な相槌"),
      pair = reactionDrops("その他");
    expect(fan[2]!.reach).toBeCloseTo(3.8 * 1.5);
    expect(fan[2]!.spreadRadius).toBeCloseTo(0.65 * 1.5);
    expect(fan.map((drop) => drop.angle)).toEqual([
      -0.54, -0.27, 0, 0.27, 0.54,
    ]);
    expect(pair).toHaveLength(1);
    expect(pair[0]!.delay).toBe(0);
    expect(REACTION_LEVELS.map(reactionPaintKind)).toEqual([
      null,
      "reaction-fan",
      "ink",
      "reaction-pair",
      null,
    ]);
  });
  it.each(REACTION_LEVELS)("removes every temporary mesh for %s", (level) => {
    const effects = new InkEffects();
    const drops = reactionDrops(level);
    for (const drop of drops) effects.emitVoice(0, 0, 0, 0.65, 0, drop);
    expect(effects.group.children.length).toBe(drops.length * 2);
    for (let i = 0; i < 50; i++) effects.update(0.05);
    expect(effects.group.children).toHaveLength(0);
    effects.dispose();
  });
});
