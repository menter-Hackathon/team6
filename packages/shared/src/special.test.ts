import { describe, expect, it } from "vitest";
import {
  advanceSpecial,
  specialPose,
  SPECIAL_DURATION,
  paintDisks,
  paintRequestSchema,
  type PaintStroke,
} from "./index.js";

describe("spin jump slam", () => {
  it("takes off, spins in the air, and returns to the ground", () => {
    expect(specialPose(0).height).toBe(0);
    expect(specialPose(0.5).height).toBeGreaterThan(2);
    expect(specialPose(0.5).height).toBeLessThan(2.2);
    expect(specialPose(0.5).spin).toBeGreaterThan(Math.PI);
    expect(specialPose(0.5).spin).toBeLessThan(Math.PI * 2);
    expect(specialPose(SPECIAL_DURATION).height).toBeCloseTo(0);
    expect(specialPose(SPECIAL_DURATION).spin % (Math.PI * 2)).toBeCloseTo(0);
  });
  it("lands once without an early impact or a cooldown", () => {
    let time = 0,
      landings = 0;
    for (let i = 0; i < 18; i++) {
      const step = advanceSpecial(time, 0.05);
      time = step.time;
      landings += Number(step.landed);
    }
    expect(landings).toBe(0);
    const landed = advanceSpecial(time, 0.05);
    expect(landed.landed).toBe(true);
    expect(landed.time).toBe(-1);
    expect(advanceSpecial(landed.time, 0.05).landed).toBe(false);
    expect(advanceSpecial(0, 0.05).time).toBe(0.05);
  });
  it("paints around the landing point and only the server can issue the slam", () => {
    const stroke: PaintStroke = {
      revision: 1,
      x: 2,
      z: -3,
      yaw: 0.2,
      team: "A",
      kind: "slam",
    };
    const disks = paintDisks(stroke);
    expect(disks[0]!.x).toBe(2);
    expect(disks[0]!.z).toBe(-3);
    expect(disks[0]!.radius).toBeGreaterThan(
      paintDisks({ ...stroke, kind: "ink" })[0]!.radius * 2,
    );
    expect(paintRequestSchema.safeParse({ kind: "slam" }).success).toBe(false);
    expect(paintDisks(stroke)).toEqual(paintDisks({ ...stroke }));
  });
});

it("smoothly stretches at takeoff and fall, then squashes on landing", () => {
  const at = (flight: number) =>
    specialPose(0.12 + flight * (SPECIAL_DURATION - 0.12)).scaleY;
  expect(at(0.12)).toBeGreaterThan(1.2);
  expect(at(0.42)).toBeLessThan(1);
  expect(at(0.86)).toBeGreaterThan(1.2);
  expect(at(1)).toBeCloseTo(0.84);
  for (const boundary of [0.12, 0.42, 0.58, 0.86])
    expect(
      Math.abs(at(boundary - 0.0001) - at(boundary + 0.0001)),
    ).toBeLessThan(0.01);
});
