import { describe, expect, it } from "vitest";
import {
  rotateYaw,
  toModelRotation,
  toWorldDirection,
} from "./input-direction";

describe("toWorldDirection", () => {
  it("moves A left and D right from the default camera", () => {
    expect(toWorldDirection(0, -1, 0)).toEqual({ x: 1, z: 0 });
    expect(toWorldDirection(0, 1, 0)).toEqual({ x: -1, z: 0 });
  });

  it("rotates movement together with the camera", () => {
    const direction = toWorldDirection(0, 1, Math.PI / 2);
    expect(direction.x).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(-1);
  });

  it("rotates the view right when the mouse moves right", () => {
    expect(rotateYaw(0, 100)).toBeGreaterThan(0);
    expect(rotateYaw(0, -100)).toBeLessThan(0);
  });

  it("converts game yaw to Three.js model rotation", () => {
    expect(toModelRotation(Math.PI / 2)).toBe(-Math.PI / 2);
  });
});
