import { describe, expect, it } from "vitest";
import { PaintField } from "./paint.js";
import {
  FIELD_HALF_DEPTH,
  PAINT_GRID_SIZE,
  isFootprintOwned,
  rasterizePaintStroke,
} from "@gaya/shared";

describe("PaintField", () => {
  it("maps paint near the far end of the rectangular field", () => {
    const field = new PaintField();
    field.apply({ revision: 1, x: 0, z: 20, yaw: 0, team: "A", kind: "ring" });
    expect(field.ownerAt(0, 20)).toBe(1);
    expect(field.ownerAt(0, -20)).toBe(0);
    expect(field.ownerAt(0, FIELD_HALF_DEPTH)).toBe(0);
  });
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
  it("keeps eight lobby ink colors distinct", () => {
    const field = new PaintField();
    field.apply({
      revision: 1,
      x: 0,
      z: 0,
      yaw: 0,
      team: "A",
      kind: "ring",
      practiceColor: "#b66bff",
    });
    expect(field.ownerAt(0, 0)).toBe(6);
    expect(field.fullyOwnedAt(0, 0, 6)).toBe(true);
    field.apply({
      revision: 2,
      x: 0,
      z: 0,
      yaw: 0,
      team: "A",
      kind: "ring",
      practiceColor: "#36f5a2",
    });
    expect(field.ownerAt(0, 0)).toBe(7);
    expect(field.fullyOwnedAt(0, 0, 6)).toBe(false);
  });
  it("clears practice paint before a match without rewinding revisions", () => {
    const field = new PaintField();
    field.apply({ revision: 1, x: 0, z: 0, yaw: 0, team: "A", kind: "ring" });
    field.reset();
    expect(field.ownerAt(0, 0)).toBe(0);
    expect(field.counts).toEqual([PAINT_GRID_SIZE ** 2, 0, 0]);
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

it("retains reaction fan and pair paint in the authoritative grid", () => {
  for (const kind of ["reaction-fan", "reaction-pair"] as const) {
    const field = new PaintField();
    field.apply({ revision: 1, x: 0, z: 0, yaw: 0, team: "A", kind });
    expect(field.counts[1]).toBeGreaterThan(0);
    field.apply({
      revision: 2,
      x: -10,
      z: -20,
      yaw: 0,
      team: "B",
      kind: "ink",
    });
    expect(field.ownerAt(0, kind === "reaction-fan" ? 5.7 : 2.7)).toBe(1);
  }
});
