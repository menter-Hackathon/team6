import {
  FIELD_HALF_SIZE,
  INK_SCALE,
  PLAYER_SIZE,
  PAINT_GRID_SIZE,
  type PaintStroke,
} from "./index.js";

export interface PaintDisk {
  x: number;
  z: number;
  radius: number;
  organic?: boolean;
}

export function inkOutlineRadius(angle: number): number {
  return 0.77 + 0.13 * Math.sin(angle * 7) + 0.1 * Math.cos(angle * 11);
}

/** Shared world-space geometry: render effects and server ownership use the same splat. */
export function paintDisks(stroke: PaintStroke): PaintDisk[] {
  const disks: PaintDisk[] = [];
  const dx = Math.sin(stroke.yaw),
    dz = Math.cos(stroke.yaw);
  const add = (forward: number, side: number, radius: number) =>
    disks.push({
      x: stroke.x + dx * forward + dz * side,
      z: stroke.z + dz * forward - dx * side,
      radius,
    });
  if (stroke.kind === "footprint") {
    const fromX = stroke.fromX ?? stroke.x,
      fromZ = stroke.fromZ ?? stroke.z;
    const length = Math.hypot(stroke.x - fromX, stroke.z - fromZ);
    const steps = Math.max(1, Math.min(128, Math.ceil(length / 0.09)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + (stroke.x - fromX) * t,
        z = fromZ + (stroke.z - fromZ) * t;
      // World-space variation joins across consecutive segments without dotted seams.
      const flow =
        1 +
        0.04 * Math.sin(x * 4.4 + z * 3.7) +
        0.02 * Math.sin(z * 9.1 - x * 6.3);
      disks.push({ x, z, radius: PLAYER_SIZE * 0.5 * flow });
      // Fused, irregular lobes make the trail pool and feather at its edges.
      // World-space modulation keeps successive segments reproducible.
      const pooling = Math.max(0, Math.sin(x * 6.8 + z * 5.3)) ** 4;
      if (length > 0.001 && pooling > 0.2) {
        const side = Math.sin(x * 2.3 - z * 4.7) >= 0 ? 1 : -1;
        const offset = PLAYER_SIZE * (0.3 + pooling * 0.1) * side;
        disks.push({
          x: x - ((stroke.z - fromZ) / length) * offset,
          z: z + ((stroke.x - fromX) / length) * offset,
          radius: PLAYER_SIZE * (0.22 + pooling * 0.1),
          organic: true,
        });
      }
    }
  } else if (stroke.kind === "ring") add(0, 0, 1.5);
  else if (stroke.kind === "line") {
    for (let t = 0.4; t <= 3.8; t += 0.15) add(t, 0, 0.55);
    for (let t = 3.2; t <= 5.2; t += 0.15) add(t, 0, (5.2 - t) * 0.65);
  } else if (stroke.kind === "fan") {
    for (let t = 1; t <= 3.5; t += 0.15) {
      const spread = (t / 3.5) * 0.8;
      for (const a of [-spread, 0, spread])
        disks.push({
          x: stroke.x + Math.sin(stroke.yaw + a) * t,
          z: stroke.z + Math.cos(stroke.yaw + a) * t,
          radius: 0.28,
        });
    }
  } else {
    // Clamp the impact first so shots near walls still coat the floor inside the arena.
    const inkDx = -dx;
    const center = {
      x: Math.max(
        -FIELD_HALF_SIZE + 0.8,
        Math.min(FIELD_HALF_SIZE - 0.8, stroke.x + inkDx * 4.5),
      ),
      z: Math.max(
        -FIELD_HALF_SIZE + 0.8,
        Math.min(FIELD_HALF_SIZE - 0.8, stroke.z + dz * 4.5),
      ),
    };
    disks.push({ ...center, radius: 0.9, organic: true });
    for (let i = 0; i < 4; i++)
      disks.push({
        x: center.x + inkDx * (0.25 + i * 0.13) + dz * (i % 2 ? 0.16 : -0.16),
        z: center.z + dz * (0.25 + i * 0.13) - inkDx * (i % 2 ? 0.16 : -0.16),
        radius: 0.4 - i * 0.055,
      });
    for (let i = 0; i < 3; i++) {
      const a = stroke.yaw + i * 2.3;
      disks.push({
        x: center.x + Math.sin(a) * 1.05,
        z: center.z + Math.cos(a) * 1.05,
        radius: 0.06 + i * 0.015,
      });
    }
  }
  return disks.map((disk) => ({
    ...disk,
    radius: disk.radius * (stroke.kind === "footprint" ? 1 : INK_SCALE),
  }));
}

export function rasterizePaintStroke(
  stroke: PaintStroke,
  put: (x: number, y: number) => void,
): void {
  const n = PAINT_GRID_SIZE,
    scale = n / (FIELD_HALF_SIZE * 2);
  for (const disk of paintDisks(stroke)) {
    const x = (disk.x + FIELD_HALF_SIZE) * scale,
      y = (disk.z + FIELD_HALF_SIZE) * scale,
      r = disk.radius * scale;
    const left = Math.max(0, Math.floor(x - r)),
      right = Math.min(n - 1, Math.ceil(x + r));
    for (
      let yy = Math.max(0, Math.floor(y - r));
      yy <= Math.min(n - 1, Math.ceil(y + r));
      yy++
    ) {
      for (let xx = left; xx <= right; xx++) {
        const radius = disk.organic
          ? r * inkOutlineRadius(Math.atan2(yy - y, xx - x))
          : r;
        if ((xx - x) ** 2 + (yy - y) ** 2 <= radius * radius) put(xx, yy);
      }
    }
  }
}
