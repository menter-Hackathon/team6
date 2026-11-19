import {
  CLASSROOM_TABLES,
  TABLE_RADIUS as R,
  TABLE_HEIGHT as H,
} from "./classroom-tables.js";
import { paintDisks, inkTravelTime } from "./paint-raster.js";
import type { PaintStroke } from "./index.js";
export interface TableInkMark {
  table: number;
  surface: "side" | "top";
  x: number;
  y: number;
  radius: number;
}
export interface TableInkHit {
  table: number;
  point: { x: number; y: number; z: number };
  mark: TableInkMark;
}
export function tableInkHit(stroke: PaintStroke): TableInkHit | null {
  if (stroke.kind !== "ink") return null;
  const disk = paintDisks(stroke)[0];
  if (!disk) return null;
  const origin = {
    x: stroke.x - Math.sin(stroke.yaw) * 0.65,
    y: 1.1 + ((stroke as PaintStroke & { height?: number }).height ?? 0),
    z: stroke.z + Math.cos(stroke.yaw) * 0.65,
  };
  const duration = inkTravelTime(
    stroke.pitch ?? 0,
    Math.hypot(disk.x - origin.x, disk.z - origin.z),
    0.035 - origin.y,
  );
  const splash =
    1.05 * (stroke.scale ?? 1) * Math.sqrt(stroke.areaMultiplier ?? 1);
  for (let step = 0; step <= 80; step++) {
    const t = step / 80,
      x = origin.x + (disk.x - origin.x) * t,
      z = origin.z + (disk.z - origin.z) * t;
    const y =
      origin.y + (0.035 - origin.y) * t + 8 * duration * duration * t * (1 - t);
    if (y > H + 0.12 || y < 0.1) continue;
    for (let table = 0; table < CLASSROOM_TABLES.length; table++) {
      const center = CLASSROOM_TABLES[table]!,
        dx = x - center.x,
        dz = z - center.z,
        length = Math.hypot(dx, dz);
      if (length > R + 0.16) continue;
      if (y >= H - 0.04 && length < R) {
        const point = { x, y: H + 0.045, z };
        return {
          table,
          point,
          mark: { table, surface: "top", x: dx, y: dz, radius: splash },
        };
      }
      const angle = Math.atan2(dz, dx),
        point = {
          x: center.x + Math.cos(angle) * (R + 0.03),
          y: Math.min(H, y),
          z: center.z + Math.sin(angle) * (R + 0.03),
        };
      return {
        table,
        point,
        mark: {
          table,
          surface: "side",
          x: ((angle + Math.PI * 2) % (Math.PI * 2)) * R,
          y: point.y,
          radius: splash,
        },
      };
    }
  }
  return null;
}
export function tableInkMarks(stroke: PaintStroke): TableInkMark[] {
  if ((stroke.height ?? 0) >= H - 0.03) {
    const marks: TableInkMark[] = [];
    for (const disk of paintDisks(stroke))
      for (let table = 0; table < CLASSROOM_TABLES.length; table++) {
        const center = CLASSROOM_TABLES[table]!;
        if (Math.hypot(disk.x - center.x, disk.z - center.z) < R + disk.radius)
          marks.push({
            table,
            surface: "top",
            x: disk.x - center.x,
            y: disk.z - center.z,
            radius: disk.radius,
          });
      }
    if (marks.length) return marks;
  }
  if (stroke.kind === "footprint") return [];
  const hit = tableInkHit(stroke);
  if (hit) return [hit.mark];
  if (stroke.kind === "ink") return [];
  const marks: TableInkMark[] = [];
  for (const disk of paintDisks(stroke))
    for (let table = 0; table < CLASSROOM_TABLES.length; table++) {
      const center = CLASSROOM_TABLES[table]!,
        dx = disk.x - center.x,
        dz = disk.z - center.z,
        distance = Math.hypot(dx, dz);
      if (distance > R + disk.radius) continue;
      const a = Math.atan2(stroke.z - center.z, stroke.x - center.x);
      marks.push({
        table,
        surface: "side",
        x: ((a + Math.PI * 2) % (Math.PI * 2)) * R,
        y: 0.6,
        radius: Math.min(1.4, disk.radius),
      });
      if (stroke.kind === "slam" || distance < R)
        marks.push({
          table,
          surface: "top",
          x: dx,
          y: dz,
          radius: disk.radius,
        });
    }
  return marks;
}

export class TableInkState {
  private marks: { mark: TableInkMark; owner: string }[][] =
    CLASSROOM_TABLES.map(() => []);
  clear() {
    this.marks = CLASSROOM_TABLES.map(() => []);
  }
  apply(stroke: PaintStroke, owner = stroke.practiceColor ?? stroke.team) {
    for (const mark of tableInkMarks(stroke))
      this.marks[mark.table]!.push({ mark, owner });
  }
  ownsAt(x: number, z: number, height: number, owner: string): boolean | null {
    if (height < 0.03) return null;
    if (Math.abs(height - H) > 0.04) return false;
    const index = CLASSROOM_TABLES.findIndex(
      (table) => Math.hypot(x - table.x, z - table.z) < R + 0.1,
    );
    if (index < 0) return false;
    const table = CLASSROOM_TABLES[index]!;
    return this.owns(index, x - table.x, z - table.z, "top", owner);
  }
  owns(
    table: number,
    x: number,
    y: number,
    surface: "side" | "top",
    owner: string,
  ) {
    const marks = this.marks[table] ?? [];
    for (let i = marks.length - 1; i >= 0; i--) {
      const entry = marks[i]!,
        mark = entry.mark;
      if (mark.surface !== surface) continue;
      let dx = Math.abs(x - mark.x);
      if (surface === "side") dx = Math.min(dx, Math.PI * 2 * R - dx);
      if (Math.hypot(dx, y - mark.y) <= mark.radius * 0.9)
        return entry.owner === owner;
    }
    return false;
  }
}
