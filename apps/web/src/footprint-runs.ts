import {
  PAINT_GRID_SIZE,
  rasterizePaintStroke,
  type PaintStroke,
} from "@gaya/shared";

/** Pairs of [start, end) cell indices, each contained in a single row. */
export function applyFootprint(
  cells: Uint8Array,
  stroke: PaintStroke,
  owner: number,
): number[] {
  const runs: number[] = [];
  rasterizePaintStroke(stroke, (x, y) => {
    const index = y * PAINT_GRID_SIZE + x;
    cells[index] = owner;
    const last = runs.length - 1;
    if (x !== 0 && runs[last] === index) runs[last] = index + 1;
    else runs.push(index, index + 1);
  });
  return runs;
}
