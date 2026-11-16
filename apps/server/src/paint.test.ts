import { describe, expect, it } from "vitest";
import { PaintField } from "./paint.js";
import {
  PAINT_GRID_SIZE,
  isFootprintOwned,
  rasterizePaintStroke,
} from "@gaya/shared";

describe("PaintField", () => {
  it("requires the entire player footprint to be owned", () => {
    const field = new PaintField();
    field.apply({ revision: 1, x: 0, z: 0, yaw: 0, team: "A", kind: "ring" });
    expect(field.fullyOwnedAt(0, 0, 1)).toBe(true);
    expect(field.fullyOwnedAt(1.95, 0, 1)).toBe(false);
    expect(field.fullyOwnedAt(0, 0, 2)).toBe(false);
    expect(field.fullyOwnedAt(0, 0, -1)).toBe(false);
  });
  it("changes ownership when another team paints the same area", () => {
    const field = new PaintField();
    field.apply({ revision: 1, x: 0, z: 0, yaw: 0, team: "A", kind: "ring" });
    expect(field.counts[1]).toBeGreaterThan(0);
    expect(field.ownerAt(0, 0)).toBe(1);
    field.apply({ revision: 2, x: 0, z: 0, yaw: 0, team: "B", kind: "ring" });
    expect(field.counts[1]).toBe(0);
    expect(field.counts[2]).toBeGreaterThan(0);
    expect(field.revision).toBe(2);
  });
  it("fills the arrow shaft and head", () => {
    const field = new PaintField();
    field.apply({ revision: 1, x: 0, z: 0, yaw: 0, team: "A", kind: "line" });
    expect(field.ownerAt(0, 2)).toBe(1);
    expect(field.ownerAt(0.8, 3.5)).toBe(1);
  });

  it("uses the same painted cells and footprint check as the client", () => {
    const field = new PaintField();
    const cells = new Uint8Array(PAINT_GRID_SIZE ** 2);
    const stroke = {
      revision: 1,
      x: 0,
      z: 0,
      yaw: 0.3,
      team: "A" as const,
      kind: "fan" as const,
    };
    field.apply(stroke);
    rasterizePaintStroke(stroke, (x, y) => {
      cells[y * PAINT_GRID_SIZE + x] = 1;
    });
    expect(cells).toEqual(field.cells);
    expect(isFootprintOwned(cells, 0, 2, 1)).toBe(field.fullyOwnedAt(0, 2, 1));
  });
});
