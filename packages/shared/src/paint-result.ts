/** Count final cell ownership. Unpainted cells do not affect either score. */
export function countPaintedCells(cells: Uint8Array): {
  scoreA: number;
  scoreB: number;
} {
  let scoreA = 0;
  let scoreB = 0;
  for (const owner of cells) {
    if (owner === 1) scoreA++;
    else if (owner === 2) scoreB++;
  }
  return { scoreA, scoreB };
}
