import { describe, expect, it } from "vitest";
import { countPaintedCells } from "./paint-result.js";

describe("countPaintedCells", () => {
  it("counts final owners and excludes unpainted cells", () => {
    const cells = Uint8Array.from([0, 1, 1, 2, 0, 2, 2]);
    expect(countPaintedCells(cells)).toEqual({ scoreA: 2, scoreB: 3 });
    cells[1] = 2;
    expect(countPaintedCells(cells)).toEqual({ scoreA: 1, scoreB: 4 });
  });

  it("returns a draw when both teams own the same number of cells", () => {
    expect(countPaintedCells(Uint8Array.from([0, 1, 2]))).toEqual({
      scoreA: 1,
      scoreB: 1,
    });
  });
});
