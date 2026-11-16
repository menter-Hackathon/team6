import { describe, expect, it } from "vitest";
import {
  DIVE_SPEED,
  PLAYER_SPEED,
  updateDiveState,
  type DiveState,
} from "./index.js";
const idle: DiveState = { submerged: false, gapSeconds: 0, team: 1 };

describe("ink diving", () => {
  it("requires own ink to start, and uses a 1.3 speed multiplier", () => {
    expect(updateDiveState(idle, true, false, 0.05, 1).submerged).toBe(false);
    expect(updateDiveState(idle, true, true, 0.05, 1).submerged).toBe(true);
    expect(DIVE_SPEED / PLAYER_SPEED).toBeCloseTo(1.3);
  });
  it("crosses short gaps, but ends a dive after the allowance expires", () => {
    const inInk = updateDiveState(idle, true, true, 0.05, 1);
    const gap = updateDiveState(inInk, true, false, 0.2, 1);
    expect(gap.submerged).toBe(true);
    expect(updateDiveState(gap, true, false, 0.1, 1).submerged).toBe(false);
    expect(updateDiveState(gap, true, true, 0.05, 1).gapSeconds).toBeCloseTo(
      0.28,
    );
  });
  it("clears the allowance on release, team change, or invalid team", () => {
    const state = updateDiveState(idle, true, true, 0.05, 1);
    expect(updateDiveState(state, false, true, 0.05, 1).submerged).toBe(false);
    expect(updateDiveState(state, true, false, 0.05, 2).submerged).toBe(false);
    expect(updateDiveState(state, true, true, 0.05, -1).submerged).toBe(false);
  });
  it("gives the same grace duration at 20 Hz and 60 Hz", () => {
    for (const fps of [20, 60]) {
      let state = updateDiveState(idle, true, true, 0, 1);
      for (let i = 0; i < fps / 5; i++)
        state = updateDiveState(state, true, false, 1 / fps, 1);
      expect(state.submerged).toBe(true);
      for (let i = 0; i < fps / 10; i++)
        state = updateDiveState(state, true, false, 1 / fps, 1);
      expect(state.submerged).toBe(false);
    }
  });
});
