import { FIELD_HALF_SIZE, PAINT_GRID_SIZE, PLAYER_RADIUS } from "./index.js";

export function isFootprintOwned(
  cells: Uint8Array,
  x: number,
  z: number,
  team: number,
): boolean {
  if (!Number.isInteger(team) || team < 1 || team > 8) return false;
  const cellSize = (FIELD_HALF_SIZE * 2) / PAINT_GRID_SIZE;
  const radius = PLAYER_RADIUS;
  const left = Math.floor((x - radius + FIELD_HALF_SIZE) / cellSize);
  const right = Math.floor((x + radius + FIELD_HALF_SIZE) / cellSize);
  const top = Math.floor((z - radius + FIELD_HALF_SIZE) / cellSize);
  const bottom = Math.floor((z + radius + FIELD_HALF_SIZE) / cellSize);
  if (
    left < 0 ||
    top < 0 ||
    right >= PAINT_GRID_SIZE ||
    bottom >= PAINT_GRID_SIZE
  )
    return false;
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const nearestX = Math.max(
        (col - PAINT_GRID_SIZE / 2) * cellSize,
        Math.min(x, (col + 1 - PAINT_GRID_SIZE / 2) * cellSize),
      );
      const nearestZ = Math.max(
        (row - PAINT_GRID_SIZE / 2) * cellSize,
        Math.min(z, (row + 1 - PAINT_GRID_SIZE / 2) * cellSize),
      );
      if (
        (nearestX - x) ** 2 + (nearestZ - z) ** 2 <= radius ** 2 &&
        cells[row * PAINT_GRID_SIZE + col] !== team
      )
        return false;
    }
  }
  return true;
}
