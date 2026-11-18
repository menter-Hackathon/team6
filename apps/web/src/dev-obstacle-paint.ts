import * as THREE from "three";
import { inkOutlineRadius, specialOutline, type PaintDisk } from "@gaya/shared";
import {
  BOX_WIDTH as W,
  BOX_DEPTH as D,
  BOX_HEIGHT as H,
  DEV_OBSTACLES,
} from "./dev-obstacle-layout";

export interface WallContour {
  box: number;
  face: number;
  points: { u: number; height: number }[];
}
function diskOutline(disk: PaintDisk): { x: number; z: number }[] {
  return disk.outlineShape
    ? specialOutline(disk.outlineShape).map((p) => {
        const angle = disk.rotation ?? 0,
          c = Math.cos(angle),
          sn = Math.sin(angle);
        return {
          x: (p.x * c - p.z * sn) * disk.radius,
          z: (p.x * sn + p.z * c) * disk.radius,
        };
      })
    : Array.from({ length: 128 }, (_, i) => {
        const angle = (i / 128) * Math.PI * 2,
          radius = disk.radius * (disk.organic ? inkOutlineRadius(angle) : 1);
        return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
      });
}

/** The same outline, clipped by the top-face canvas instead of being baked onto the ground. */
export function topContours(
  disks: readonly PaintDisk[],
  height: number,
): WallContour[] {
  if (Math.abs(height - H) > 0.1) return [];
  const result: WallContour[] = [];
  DEV_OBSTACLES.forEach((box, index) => {
    for (const disk of disks) {
      const points = diskOutline(disk).map((p) => ({
        u: disk.x + p.x - box.x,
        height: box.z + D / 2 - (disk.z + p.z),
      }));
      if (
        Math.max(...points.map((p) => p.u)) < -W / 2 ||
        Math.min(...points.map((p) => p.u)) > W / 2 ||
        Math.max(...points.map((p) => p.height)) < 0 ||
        Math.min(...points.map((p) => p.height)) > D
      )
        continue;
      result.push({ box: index, face: 4, points });
    }
  });
  return result;
}

/** Unfold the actual floor outline onto a wall. Canvas clipping keeps only the touching part. */
export function wallContours(
  disks: readonly PaintDisk[],
  origin: { x: number; z: number },
): WallContour[] {
  const result: WallContour[] = [];
  DEV_OBSTACLES.forEach((box, index) => {
    const sides = [
      { face: 0, nx: 0, nz: 1, x: box.x, z: box.z + D / 2, width: W },
      { face: 1, nx: 0, nz: -1, x: box.x, z: box.z - D / 2, width: W },
      { face: 2, nx: 1, nz: 0, x: box.x + W / 2, z: box.z, width: D },
      { face: 3, nx: -1, nz: 0, x: box.x - W / 2, z: box.z, width: D },
    ];
    for (const side of sides) {
      // A floor splat cannot paint the hidden opposite side through the box.
      if (
        (origin.x - side.x) * side.nx + (origin.z - side.z) * side.nz <
        -0.001
      )
        continue;
      for (const disk of disks) {
        const envelope = disk.radius * (disk.outlineShape ? 2 : 1);
        const centerHeight = -(
          (disk.x - side.x) * side.nx +
          (disk.z - side.z) * side.nz
        );
        const centerU =
          side.face === 0
            ? disk.x - box.x
            : side.face === 1
              ? box.x - disk.x
              : side.face === 2
                ? box.z - disk.z
                : disk.z - box.z;
        if (
          centerHeight + envelope <= 0 ||
          centerHeight - envelope > H ||
          centerU + envelope < -side.width / 2 ||
          centerU - envelope > side.width / 2
        )
          continue;
        const outline = diskOutline(disk);
        const points = outline.map((p) => {
          const x = disk.x + p.x,
            z = disk.z + p.z;
          const u =
            side.face === 0
              ? x - box.x
              : side.face === 1
                ? box.x - x
                : side.face === 2
                  ? box.z - z
                  : z - box.z;
          return {
            u,
            height: -((x - side.x) * side.nx + (z - side.z) * side.nz),
          };
        });
        if (
          Math.max(...points.map((p) => p.height)) <= 0.001 ||
          Math.min(...points.map((p) => p.height)) > H ||
          Math.max(...points.map((p) => p.u)) < -side.width / 2 ||
          Math.min(...points.map((p) => p.u)) > side.width / 2
        )
          continue;
        result.push({ box: index, face: side.face, points });
      }
    }
  });
  return result;
}

/** Exact sphere-to-box distance avoids the false corner hits of an expanded AABB alone. */
export function sweptInkContact(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  bounds: THREE.Box3,
): THREE.Vector3 | null {
  const direction = end.clone().sub(start),
    length = direction.length();
  if (bounds.distanceToPoint(start) <= radius)
    return bounds.clampPoint(start, new THREE.Vector3());
  if (!length) return null;
  const broad = new THREE.Ray(
    start,
    direction.clone().normalize(),
  ).intersectBox(bounds.clone().expandByScalar(radius), new THREE.Vector3());
  if (!broad || broad.distanceTo(start) > length + 1e-8) return null;
  const distance = (t: number) => {
    const x = start.x + direction.x * t,
      y = start.y + direction.y * t,
      z = start.z + direction.z * t;
    return (
      Math.max(bounds.min.x - x, 0, x - bounds.max.x) ** 2 +
      Math.max(bounds.min.y - y, 0, y - bounds.max.y) ** 2 +
      Math.max(bounds.min.z - z, 0, z - bounds.max.z) ** 2
    );
  };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 28; i++) {
    const a = lo + (hi - lo) / 3,
      b = hi - (hi - lo) / 3;
    if (distance(a) < distance(b)) hi = b;
    else lo = a;
  }
  const min = (lo + hi) / 2;
  if (
    Math.min(distance(0), distance(1), distance(min)) >
    radius * radius + 1e-8
  )
    return null;
  lo = 0;
  hi = distance(1) < distance(min) ? 1 : min;
  if (distance(0) <= radius * radius) hi = 0;
  else
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (distance(mid) <= radius * radius) hi = mid;
      else lo = mid;
    }
  return bounds.clampPoint(
    start.clone().addScaledVector(direction, hi),
    new THREE.Vector3(),
  );
}

/** Spread across adjacent faces when the contact patch reaches a box edge. */
export function adjacentFaceStamps(
  index: number,
  point: THREE.Vector3,
  radius: number,
) {
  const box = DEV_OBSTACLES[index]!;
  const planes = [
    { axis: "z" as const, value: box.z + D / 2 },
    { axis: "z" as const, value: box.z - D / 2 },
    { axis: "x" as const, value: box.x + W / 2 },
    { axis: "x" as const, value: box.x - W / 2 },
    { axis: "y" as const, value: H },
  ];
  return planes.flatMap((plane, face) => {
    const distance = Math.abs(point[plane.axis] - plane.value);
    if (distance >= radius) return [];
    const projected = point.clone();
    projected[plane.axis] = plane.value;
    return [
      {
        box: index,
        face,
        point: projected,
        radius: Math.sqrt(radius * radius - distance * distance),
      },
    ];
  });
}
