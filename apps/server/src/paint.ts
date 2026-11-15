import { FIELD_HALF_SIZE, PAINT_GRID_SIZE, type PaintStroke } from "@gaya/shared";

export class PaintField {
  readonly cells = new Uint8Array(PAINT_GRID_SIZE * PAINT_GRID_SIZE);
  revision = 0;
  counts = [0, 0, 0];

  apply(stroke: PaintStroke): void {
    const n = PAINT_GRID_SIZE;
    const scale = n / (FIELD_HALF_SIZE * 2);
    const cx = (stroke.x + FIELD_HALF_SIZE) * scale;
    const cy = (stroke.z + FIELD_HALF_SIZE) * scale;
    const radius = 1.5 * scale;
    const team = stroke.team === "A" ? 1 : 2;
    const put = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const i = y * n + x;
      const previous = this.cells[i]!;
      if (previous === team) return;
      this.counts[previous]!--;
      this.counts[team]!++;
      this.cells[i] = team;
    };
    const disk = (x: number, y: number, r: number) => {
      const left = Math.max(0, Math.floor(x - r));
      const right = Math.min(n - 1, Math.ceil(x + r));
      for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(n - 1, Math.ceil(y + r)); yy++) {
        for (let xx = left; xx <= right; xx++) if ((xx-x)**2 + (yy-y)**2 <= r*r) put(xx, yy);
      }
    };
    const dx = Math.sin(stroke.yaw), dy = Math.cos(stroke.yaw);
    if (stroke.kind === "ring") {
      for (let y = -Math.ceil(radius); y <= Math.ceil(radius); y++) for (let x = -Math.ceil(radius); x <= Math.ceil(radius); x++) {
        const d = Math.hypot(x, y);
        if (d >= radius * 0.55 && d <= radius) put(Math.round(cx+x), Math.round(cy+y));
      }
    } else if (stroke.kind === "line") {
      for (let t = 0.4; t <= 5; t += 0.12) disk(cx + dx*t*scale, cy + dy*t*scale, 0.25*scale);
    } else {
      for (let t = 1; t <= 3.5; t += 0.15) {
        const spread = (t / 3.5) * 0.8;
        for (const a of [-spread, 0, spread]) disk(cx + Math.sin(stroke.yaw+a)*t*scale, cy + Math.cos(stroke.yaw+a)*t*scale, 0.28*scale);
      }
    }
    this.revision++;
  }
}
