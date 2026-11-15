import { describe, expect, it } from "vitest";
import { PaintField } from "./paint.js";

describe("PaintField", () => {
  it("changes ownership when another team paints the same area", () => {
    const field = new PaintField();
    field.apply({ revision: 1, x: 0, z: 0, yaw: 0, team: "A", kind: "ring" });
    expect(field.counts[1]).toBeGreaterThan(0);
    field.apply({ revision: 2, x: 0, z: 0, yaw: 0, team: "B", kind: "ring" });
    expect(field.counts[1]).toBe(0);
    expect(field.counts[2]).toBeGreaterThan(0);
    expect(field.revision).toBe(2);
  });
});
