import { expect, it } from "vitest";
import { wallInkHit, wallInkMarks } from "./classroom-walls.js";
import {
  FIELD_HALF_WIDTH as W,
  FIELD_HALF_DEPTH as D,
  type PaintStroke,
} from "./index.js";
import { rasterizePaintStroke } from "./paint-raster.js";
const stroke: PaintStroke = {
  revision: 1,
  team: "A",
  kind: "ink",
  x: 0,
  z: D - 1,
  yaw: 0,
};
it("hits each room wall from the inside without painting past it", () => {
  for (const value of [
    stroke,
    { ...stroke, z: -D + 1, yaw: Math.PI },
    { ...stroke, x: -W + 1, z: 0, yaw: Math.PI / 2 },
    { ...stroke, x: W - 1, z: 0, yaw: -Math.PI / 2 },
  ]) {
    expect(wallInkHit(value)).not.toBeNull();
    let pixels = 0;
    rasterizePaintStroke(value, () => pixels++);
    expect(pixels).toBe(0);
  }
});
it("wraps the touching edge of ground paint onto a wall and leaves centre-field shots alone", () => {
  expect(
    wallInkMarks({ ...stroke, kind: "slam", specialShape: "ink" }).length,
  ).toBeGreaterThan(0);
  expect(wallInkMarks({ ...stroke, z: 0 })).toEqual([]);
});
