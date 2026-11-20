import {
  PAINT_GRID_SIZE,
  rasterizePaintStroke,
  type PaintStroke,
} from "@gaya/shared";
import { expect, it } from "vitest";
import { applyFootprint } from "./footprint-runs";

it("preserves the exact footprint pixels and their order within each row run", () => {
  const cells = new Uint8Array(PAINT_GRID_SIZE ** 2);
  const base: PaintStroke = {
    kind: "footprint",
    team: "A",
    revision: 1,
    x: 0,
    z: 0,
    yaw: 0,
  };
  for (const stroke of [
    base,
    { ...base, fromX: -0.2, fromZ: 0.1, areaMultiplier: 1.5 },
    { ...base, x: -21, z: 40, fromX: -20.9, fromZ: 39.8 },
  ]) {
    const expected: number[] = [];
    rasterizePaintStroke(stroke, (x, y) =>
      expected.push(y * PAINT_GRID_SIZE + x),
    );
    const actual: number[] = [];
    const runs = applyFootprint(cells, stroke, 1);
    for (let i = 0; i < runs.length; i += 2) {
      const start = runs[i]!;
      const end = runs[i + 1]!;
      expect(Math.floor(start / PAINT_GRID_SIZE)).toBe(
        Math.floor((end - 1) / PAINT_GRID_SIZE),
      );
      for (let cell = start; cell < end; cell++) actual.push(cell);
    }
    expect(actual).toEqual(expected);
    expect(expected.every((cell) => cells[cell] === 1)).toBe(true);
  }
});
