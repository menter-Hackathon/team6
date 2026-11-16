import {
  FIELD_HALF_SIZE,
  INK_SCALE,
  SPECIAL_RADIUS,
  specialOutline,
  type SpecialShape,
  INK_SPLAT_SCALE,
  PLAYER_SIZE,
  PAINT_GRID_SIZE,
  type PaintStroke,
} from "./index.js";

export interface PaintDisk {
  x: number;
  z: number;
  radius: number;
  organic?: boolean;
  outlineShape?: Exclude<SpecialShape, "ink">;
  rotation?: number;
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
  if (stroke.kind === "slam" && stroke.specialShape === "ink") {
    disks.push({
      x: stroke.x,
      z: stroke.z,
      radius: SPECIAL_RADIUS,
      organic: true,
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + stroke.yaw,
        reach = SPECIAL_RADIUS * (0.65 + 0.06 * Math.sin(i * 2.3));
      disks.push({
        x: stroke.x + Math.cos(a) * reach,
        z: stroke.z + Math.sin(a) * reach,
        radius: SPECIAL_RADIUS * (0.25 + 0.025 * Math.cos(i * 1.8)),
        organic: true,
      });
      disks.push({
        x: stroke.x + Math.cos(a) * SPECIAL_RADIUS * 1.15,
        z: stroke.z + Math.sin(a) * SPECIAL_RADIUS * 1.15,
        radius: 0.09 + (i % 3) * 0.035,
      });
    }
  } else if (stroke.kind === "slam") {
    const shape = stroke.specialShape === "heart" ? "heart" : "star";
    disks.push({
      x: stroke.x,
      z: stroke.z,
      radius: SPECIAL_RADIUS,
      outlineShape: shape,
      rotation: stroke.yaw,
    });
    const outline = specialOutline(shape),
      c = Math.cos(stroke.yaw),
      sn = Math.sin(stroke.yaw);
    // Detached flecks sit beyond the thin fingers that interrupt the silhouette's sides.
    const jets =
      shape === "star"
        ? [7, 22, 29, 46, 65, 73, 91, 106]
        : [16, 24, 33, 42, 51, 60, 73, 82, 91, 102, 112];
    for (let j = 0; j < jets.length; j++) {
      const i = jets[j]!,
        p = outline[i]!,
        radial = Math.hypot(p.x, p.z) || 1;
      const gap =
        (shape === "heart" ? 0.075 : 0.055) +
        (j % 3) * (shape === "heart" ? 0.035 : 0.025);
      const px = p.x + (p.x / radial) * gap,
        pz = p.z + (p.z / radial) * gap;
      const x = (px * c - pz * sn) * SPECIAL_RADIUS * INK_SCALE,
        z = (px * sn + pz * c) * SPECIAL_RADIUS * INK_SCALE;
      disks.push({
        x: stroke.x + x,
        z: stroke.z + z,
        radius:
          (shape === "heart" ? 0.045 : 0.035) +
          (j % 4) * (shape === "heart" ? 0.02 : 0.012),
      });
      if (j % (shape === "heart" ? 2 : 3) === 0)
        disks.push({
          x: stroke.x + x * 1.07,
          z: stroke.z + z * 1.07,
          radius: 0.022,
        });
    }
  } else if (stroke.kind === "footprint") {
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
  const impact = stroke.kind === "ink" ? disks[0] : undefined;
  return disks.map((disk) => ({
    ...disk,
    x: impact ? impact.x + (disk.x - impact.x) * INK_SPLAT_SCALE : disk.x,
    z: impact ? impact.z + (disk.z - impact.z) * INK_SPLAT_SCALE : disk.z,
    radius:
      disk.radius *
      (stroke.kind === "footprint" ? 1 : INK_SCALE) *
      (impact ? INK_SPLAT_SCALE : 1),
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
    if (disk.outlineShape) {
      const angle = disk.rotation ?? 0,
        c = Math.cos(angle),
        sn = Math.sin(angle);
      const points = specialOutline(disk.outlineShape).map((p) => ({
        x: x + (p.x * c - p.z * sn) * r,
        y: y + (p.x * sn + p.z * c) * r,
      }));
      const top = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)))),
        bottom = Math.min(
          n - 1,
          Math.ceil(Math.max(...points.map((p) => p.y))),
        );
      for (let row = top; row <= bottom; row++) {
        const hits: number[] = [];
        for (let i = 0; i < points.length; i++) {
          const a = points[i]!,
            b = points[(i + 1) % points.length]!;
          if (a.y > row !== b.y > row)
            hits.push(a.x + ((row - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
        hits.sort((a, b) => a - b);
        for (let i = 0; i + 1 < hits.length; i += 2) {
          const left = Math.max(0, Math.ceil(hits[i]!)),
            right = Math.min(n - 1, Math.floor(hits[i + 1]!));
          for (let col = left; col <= right; col++) put(col, row);
        }
      }
      continue;
    }
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
