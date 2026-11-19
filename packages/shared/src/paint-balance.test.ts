import { describe, expect, it } from "vitest";
import { speakerTeamAreaMultiplier } from "./paint-balance.js";

describe("speaker team paint balance", () => {
  it.each([
    [2, 2],
    [3, 1.5],
    [4, 4 / 3],
  ])("scales a %i-person team's paint area by %f", (size, multiplier) => {
    expect(speakerTeamAreaMultiplier(size)).toBeCloseTo(multiplier);
  });
});
