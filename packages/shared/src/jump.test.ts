import { describe, expect, it } from "vitest";
import {
  advanceJump,
  jumpHeight,
  JUMP_DURATION,
  JUMP_HEIGHT,
} from "./index.js";

describe("jump animation", () => {
  it("rises, peaks midway, and lands after the jump duration", () => {
    expect(jumpHeight(-1)).toBe(0);
    expect(jumpHeight(0)).toBe(0);
    expect(jumpHeight(JUMP_DURATION / 2)).toBeCloseTo(JUMP_HEIGHT);
    expect(advanceJump(0, JUMP_DURATION)).toBe(-1);
    expect(advanceJump(-1, 0.1)).toBe(-1);
  });
});
