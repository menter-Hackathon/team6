import { expect, it } from "vitest";
import { tableInkHit, tableInkMarks } from "./table-ink.js";
import { rasterizePaintStroke } from "./paint-raster.js";
import { TABLE_RADIUS } from "./classroom-tables.js";
import type { PaintStroke } from "./index.js";
const stroke: PaintStroke = {
  revision: 1,
  x: 8,
  z: 4,
  yaw: 0,
  team: "A",
  kind: "ink",
};
it("hits the round cloth and prevents ownership from appearing on the floor behind it", () => {
  const hit = tableInkHit(stroke);
  expect(hit).not.toBeNull();
  expect(hit!.table).toBe(5);
  expect(hit!.mark.surface).toBe("side");
  expect(hit!.point.z).toBeCloseTo(9 - TABLE_RADIUS - 0.03, 1);
  let pixels = 0;
  rasterizePaintStroke(stroke, () => pixels++);
  expect(pixels).toBe(0);
});
it("leaves a clear aisle shot alone, without imaginary cloth paint", () => {
  const clear = { ...stroke, x: 0 };
  expect(tableInkHit(clear)).toBeNull();
  expect(tableInkMarks(clear)).toEqual([]);
  let pixels = 0;
  rasterizePaintStroke(clear, () => pixels++);
  expect(pixels).toBeGreaterThan(0);
});
it("paints cloth for fan and landing splashes, while walking does not paint a table", () => {
  expect(
    tableInkMarks({ ...stroke, z: 8, kind: "slam", specialShape: "ink" })
      .length,
  ).toBeGreaterThan(0);
  expect(
    tableInkMarks({ ...stroke, z: 6, kind: "reaction-fan" }).length,
  ).toBeGreaterThan(0);
  expect(tableInkMarks({ ...stroke, kind: "footprint" })).toEqual([]);
});

import { TableInkState } from "./table-ink.js";
it("uses the last cloth color for climbing and paints footprints on the top", () => {
  const ink = new TableInkState();
  ink.apply(stroke);
  const mark = tableInkMarks(stroke)[0]!;
  expect(ink.owns(mark.table, mark.x, mark.y, mark.surface, "A")).toBe(true);
  expect(ink.owns(mark.table, mark.x, mark.y, mark.surface, "B")).toBe(false);
  ink.apply({ ...stroke, team: "B" });
  expect(ink.owns(mark.table, mark.x, mark.y, mark.surface, "A")).toBe(false);
  const top = {
    ...stroke,
    x: 8,
    z: 9,
    height: 1.6,
    kind: "footprint" as const,
  };
  expect(tableInkMarks(top).some((mark) => mark.surface === "top")).toBe(true);
  let pixels = 0;
  rasterizePaintStroke(top, () => pixels++);
  expect(pixels).toBe(0);
});
