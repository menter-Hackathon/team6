import { describe, expect, it } from "vitest";
import { FIELD_HALF_DEPTH, FIELD_HALF_WIDTH, teamStartPosition } from "./index.js";

describe("team start positions", () => {
  it.each([2, 3, 4])("places %i teammates evenly along opposite short sides", (count) => {
    const a = Array.from({ length: count }, (_, index) => teamStartPosition("A", index, count));
    const b = Array.from({ length: count }, (_, index) => teamStartPosition("B", index, count));
    expect(a.map((position) => position.x)).toEqual(b.map((position) => position.x));
    expect(a.every((position) => position.z < 0 && Math.abs(position.z) < FIELD_HALF_DEPTH && Math.abs(position.x) < FIELD_HALF_WIDTH)).toBe(true);
    expect(b.every((position) => position.z > 0 && Math.abs(position.z) < FIELD_HALF_DEPTH && Math.abs(position.x) < FIELD_HALF_WIDTH)).toBe(true);
    const gaps = a.slice(1).map((position, index) => position.x - a[index]!.x);
    expect(gaps.every((gap) => Math.abs(gap - gaps[0]!) < 1e-10)).toBe(true);
    expect(a[0]!.yaw).toBe(0);
    expect(b[0]!.yaw).toBe(Math.PI);
  });
});
