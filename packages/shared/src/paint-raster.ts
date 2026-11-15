import { FIELD_HALF_SIZE, PAINT_GRID_SIZE, type PaintStroke } from "./index.js";

export function rasterizePaintStroke(stroke: PaintStroke, put: (x: number, y: number) => void): void {
    const n = PAINT_GRID_SIZE;
    const scale = n / (FIELD_HALF_SIZE * 2);
    const cx = (stroke.x + FIELD_HALF_SIZE) * scale;
    const cy = (stroke.z + FIELD_HALF_SIZE) * scale;
    const radius = 1.5 * scale;
    const disk = (x: number, y: number, r: number) => {
      const left = Math.max(0, Math.floor(x - r));
      const right = Math.min(n - 1, Math.ceil(x + r));
      for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(n - 1, Math.ceil(y + r)); yy++) {
        for (let xx = left; xx <= right; xx++) if ((xx-x)**2 + (yy-y)**2 <= r*r) put(xx, yy);
      }
    };
    const dx = Math.sin(stroke.yaw), dy = Math.cos(stroke.yaw);
    if (stroke.kind === "ring") {
      disk(cx, cy, radius);
    } else if (stroke.kind === "line") {
      // A solid arrow: a wide shaft and an overlapping triangular head.
      for (let t = 0.4; t <= 3.8; t += 0.15) disk(cx + dx*t*scale, cy + dy*t*scale, 0.55*scale);
      for (let t = 3.2; t <= 5.2; t += 0.15) disk(cx + dx*t*scale, cy + dy*t*scale, (5.2-t)*0.65*scale);
    } else {
      for (let t = 1; t <= 3.5; t += 0.15) {
        const spread = (t / 3.5) * 0.8;
        for (const a of [-spread, 0, spread]) disk(cx + Math.sin(stroke.yaw+a)*t*scale, cy + Math.cos(stroke.yaw+a)*t*scale, 0.28*scale);
      }
    }
}
