import {
  FIELD_HALF_WIDTH as W,
  FIELD_HALF_DEPTH as D,
  type PaintStroke,
} from "./index.js";
import { paintDisks, inkTravelTime, inkFlight } from "./paint-raster.js";
export const CLASSROOM_HEIGHT = 6.4;
export interface WallInkMark {
  wall: number;
  x: number;
  y: number;
  radius: number;
}
export function wallInkHit(stroke: PaintStroke) {
  if (stroke.kind !== "ink") return null;
  const flight = inkFlight(stroke.pitch ?? 0);
  const disk = {
    x: stroke.x - Math.sin(stroke.yaw) * flight.distance,
    z: stroke.z + Math.cos(stroke.yaw) * flight.distance,
  };
  const origin = {
    x: stroke.x - Math.sin(stroke.yaw) * 0.65,
    y: 1.1 + (stroke.height ?? 0),
    z: stroke.z + Math.cos(stroke.yaw) * 0.65,
  };
  const duration = inkTravelTime(
    stroke.pitch ?? 0,
    Math.hypot(disk.x - origin.x, disk.z - origin.z),
    0.035 - origin.y,
  );
  for (let i = 0; i <= 96; i++) {
    const t = i / 96,
      x = origin.x + (disk.x - origin.x) * t,
      z = origin.z + (disk.z - origin.z) * t;
    const y =
      origin.y + (0.035 - origin.y) * t + 8 * duration * duration * t * (1 - t);
    if (y < 0 || y > CLASSROOM_HEIGHT) continue;
    const wall = z >= D ? 0 : z <= -D ? 1 : x <= -W ? 2 : x >= W ? 3 : -1;
    if (wall < 0) continue;
    const point = {
      x: Math.max(-W, Math.min(W, x)),
      y,
      z: Math.max(-D, Math.min(D, z)),
    };
    const u =
      wall === 0
        ? -point.x
        : wall === 1
          ? point.x
          : wall === 2
            ? -point.z
            : point.z;
    return {
      point,
      mark: {
        wall,
        x: u,
        y,
        radius:
          1.05 * (stroke.scale ?? 1) * Math.sqrt(stroke.areaMultiplier ?? 1),
      },
    };
  }
  return null;
}
export function wallInkMarks(stroke: PaintStroke): WallInkMark[] {
  const hit = wallInkHit(stroke);
  if (hit) return [hit.mark];
  const marks: WallInkMark[] = [];
  for (const disk of paintDisks(stroke)) {
    const distances = [D - disk.z, D + disk.z, W + disk.x, W - disk.x];
    distances.forEach((distance, wall) => {
      if (distance < 0 || distance > disk.radius) return;
      marks.push({
        wall,
        x:
          wall === 0
            ? -disk.x
            : wall === 1
              ? disk.x
              : wall === 2
                ? -disk.z
                : disk.z,
        y: stroke.height ?? 0,
        radius: Math.sqrt(disk.radius * disk.radius - distance * distance),
      });
    });
  }
  return marks;
}
