import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { followSurfaceHeight, MantleBlend } from "./climb-display";

describe("climb display", () => {
  it("blends the ledge step, catches moving targets, and snaps on reset", () => {
    const blend = new MantleBlend();
    const display = new Vector3(0, 1.25, 0);
    const target = new Vector3(0, 2.4, 0.685);
    blend.start(display, target);
    blend.apply(display, target, 1 / 60);
    expect(display.y).toBeGreaterThan(1.25);
    expect(display.y).toBeLessThan(1.4);
    expect(target.y).toBe(2.4);
    for (let i = 0; i < 10; i++) {
      target.z += 0.08;
      blend.apply(display, target, 1 / 60);
    }
    expect(display.equals(target)).toBe(true);
    blend.start(display, target);
    blend.reset();
    target.set(10, 0, -20);
    blend.apply(display, target, 0);
    expect(display.equals(target)).toBe(true);
  });

  it("continues moving between received heights and settles exactly at the floor", () => {
    let height = followSurfaceHeight(1.6, 1.43, 1 / 60);
    const first = height;
    height = followSurfaceHeight(height, 1.43, 1 / 60);
    expect(height).toBeLessThan(first);
    expect(height).toBeGreaterThan(1.43);
    expect(height).toBeCloseTo(followSurfaceHeight(1.6, 1.43, 1 / 30), 10);
    for (let i = 0; i < 60; i++)
      height = followSurfaceHeight(height, 0, 1 / 60);
    expect(height).toBe(0);
  });
});
