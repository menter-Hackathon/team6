import {
  FIELD_HALF_SIZE,
  PAINT_GRID_SIZE,
  isFootprintOwned,
  rasterizePaintStroke,
  practiceColorOwner,
  type PaintStroke,
} from "@gaya/shared";

export class PaintField {
  readonly cells = new Uint8Array(PAINT_GRID_SIZE * PAINT_GRID_SIZE);
  revision = 0;
  counts = [PAINT_GRID_SIZE * PAINT_GRID_SIZE, 0, 0];

  reset(): void {
    this.cells.fill(0);
    this.counts = [this.cells.length, 0, 0];
    this.revision++;
  }

  ownerAt(x: number, z: number): number {
    const n = PAINT_GRID_SIZE;
    const gx = Math.floor(((x + FIELD_HALF_SIZE) * n) / (FIELD_HALF_SIZE * 2));
    const gz = Math.floor(((z + FIELD_HALF_SIZE) * n) / (FIELD_HALF_SIZE * 2));
    return gx < 0 || gz < 0 || gx >= n || gz >= n
      ? 0
      : this.cells[gz * n + gx]!;
  }

  fullyOwnedAt(x: number, z: number, team: number): boolean {
    return isFootprintOwned(this.cells, x, z, team);
  }

  apply(stroke: PaintStroke): void {
    rasterizePaintStroke(stroke, (x, y) => {
      if (x < 0 || y < 0 || x >= PAINT_GRID_SIZE || y >= PAINT_GRID_SIZE)
        return;
      const index = y * PAINT_GRID_SIZE + x;
      const team = stroke.practiceColor
        ? practiceColorOwner(stroke.practiceColor)
        : stroke.team === "A"
          ? 1
          : 2;
      const previous = this.cells[index]!;
      if (previous === team) return;
      this.counts[team] ??= 0;
      this.counts[previous]!--;
      this.counts[team]!++;
      this.cells[index] = team;
    });
    this.revision++;
  }
}
