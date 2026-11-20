import { describe, expect, it } from "vitest";
import { moveInputSchema, teamStartPosition } from "@gaya/shared";
import {
  normalizeYaw,
  rotateYaw,
  rotatePitch,
  toModelRotation,
  toWorldDirection,
} from "./input-direction";

describe("toWorldDirection", () => {
  it.each(["A", "B"] as const)("accepts team %s's first forward input after float32 sync", (team) => {
    const spawn = teamStartPosition(team, 0, 1);
    const yaw = normalizeYaw(Math.fround(spawn.yaw));
    const direction = toWorldDirection(1, 0, yaw);
    expect(direction.z * spawn.z).toBeLessThan(0);
    expect(moveInputSchema.safeParse({ sequence: 1, ...direction, yaw, dive: false }).success).toBe(true);
  });

  it("moves A left and D right from the default camera", () => {
    expect(toWorldDirection(0, -1, 0)).toEqual({ x: 1, z: 0 });
    expect(toWorldDirection(0, 1, 0)).toEqual({ x: -1, z: 0 });
  });

  it("rotates movement together with the camera", () => {
    const direction = toWorldDirection(0, 1, Math.PI / 2);
    expect(direction.x).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(-1);
  });

  it("normalizes diagonal input after camera rotation", () => {
    const direction = toWorldDirection(1, 1, Math.PI / 4);
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1);
    expect(direction.x).toBeGreaterThanOrEqual(-1);
    expect(direction.x).toBeLessThanOrEqual(1);
    expect(direction.z).toBeGreaterThanOrEqual(-1);
    expect(direction.z).toBeLessThanOrEqual(1);
    expect(
      moveInputSchema.safeParse({
        sequence: 1,
        ...direction,
        yaw: Math.PI / 4,
        dive: false,
      }).success,
    ).toBe(true);
  });

  it("rotates the view right when the mouse moves right", () => {
    expect(rotateYaw(0, 100)).toBeGreaterThan(0);
    expect(rotateYaw(0, -100)).toBeLessThan(0);
  });

  it("clamps vertical aim without changing horizontal model rotation", () => {
    expect(rotatePitch(0, -100)).toBeGreaterThan(0);
    expect(rotatePitch(0, 100)).toBeLessThan(0);
    expect(rotatePitch(0, -10000)).toBeCloseTo(Math.PI / 3);
    expect(rotatePitch(0, 10000)).toBeCloseTo(-Math.PI / 3);
    expect(toModelRotation(Math.PI / 2)).toBe(-Math.PI / 2);
  });

  it("converts game yaw to Three.js model rotation", () => {
    expect(toModelRotation(Math.PI / 2)).toBe(-Math.PI / 2);
  });
});
