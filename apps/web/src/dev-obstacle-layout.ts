export const BOX_WIDTH = 3,
  BOX_DEPTH = 2,
  BOX_HEIGHT = 2.4;
export const DEV_OBSTACLES = [
  { id: "near-left", x: -4, z: -8 },
  { id: "near-right", x: 4, z: -8 },
  { id: "far-left", x: -4, z: 8 },
  { id: "far-right", x: 4, z: 8 },
] as const;
export function obstacleFloor(x: number, z: number): number {
  return DEV_OBSTACLES.some(
    (box) =>
      Math.abs(x - box.x) < BOX_WIDTH / 2 + 0.3 &&
      Math.abs(z - box.z) < BOX_DEPTH / 2 + 0.3,
  )
    ? BOX_HEIGHT
    : 0;
}
export function obstacleMove(
  oldX: number,
  oldZ: number,
  x: number,
  z: number,
  feet: number,
) {
  if (feet >= BOX_HEIGHT - 0.015) return { x, z };
  for (const box of DEV_OBSTACLES) {
    const left = box.x - BOX_WIDTH / 2 - 0.5,
      right = box.x + BOX_WIDTH / 2 + 0.5;
    const near = box.z - BOX_DEPTH / 2 - 0.5,
      far = box.z + BOX_DEPTH / 2 + 0.5;
    if (oldZ > near && oldZ < far) {
      if (oldX <= left && x > left) x = left;
      if (oldX >= right && x < right) x = right;
    }
    if (x > left && x < right) {
      if (oldZ <= near && z > near) z = near;
      if (oldZ >= far && z < far) z = far;
    }
  }
  return { x, z };
}

export const obstacleInk: {
  sample: (
    box: number,
    face: number,
    u: number,
    v: number,
    color: string,
  ) => boolean;
} = { sample: () => false };
export interface PaintedWall {
  x: number;
  z: number;
  nx: number;
  nz: number;
}
export function paintedWall(
  x: number,
  z: number,
  feet: number,
  color: string,
): PaintedWall | null {
  if (feet >= BOX_HEIGHT - 0.02) return null;
  for (let index = 0; index < DEV_OBSTACLES.length; index++) {
    const box = DEV_OBSTACLES[index]!,
      dx = x - box.x,
      dz = z - box.z;
    const sides = [
      {
        face: 0,
        distance: Math.abs(dz - BOX_DEPTH / 2),
        within: Math.abs(dx) < BOX_WIDTH / 2 + 0.1,
        u: dx,
        nx: 0,
        nz: 1,
        x,
        z: box.z + BOX_DEPTH / 2,
      },
      {
        face: 1,
        distance: Math.abs(dz + BOX_DEPTH / 2),
        within: Math.abs(dx) < BOX_WIDTH / 2 + 0.1,
        u: -dx,
        nx: 0,
        nz: -1,
        x,
        z: box.z - BOX_DEPTH / 2,
      },
      {
        face: 2,
        distance: Math.abs(dx - BOX_WIDTH / 2),
        within: Math.abs(dz) < BOX_DEPTH / 2 + 0.1,
        u: -dz,
        nx: 1,
        nz: 0,
        x: box.x + BOX_WIDTH / 2,
        z,
      },
      {
        face: 3,
        distance: Math.abs(dx + BOX_WIDTH / 2),
        within: Math.abs(dz) < BOX_DEPTH / 2 + 0.1,
        u: dz,
        nx: -1,
        nz: 0,
        x: box.x - BOX_WIDTH / 2,
        z,
      },
    ];
    for (const side of sides) {
      if (!side.within || side.distance > 0.65) continue;
      const ink = [0.2, 0.5, 0.8].some((offset) =>
        obstacleInk.sample(
          index,
          side.face,
          side.u,
          Math.min(BOX_HEIGHT - 0.02, feet + offset) - BOX_HEIGHT / 2,
          color,
        ),
      );
      if (ink) return { x: side.x, z: side.z, nx: side.nx, nz: side.nz };
    }
  }
  return null;
}

/** Read ink on the surface under the feet, rather than the ground beneath a box. */
export function surfacePaintOwned(
  x: number,
  z: number,
  feet: number,
  color: string,
  groundOwned: (x: number, z: number) => boolean,
): boolean {
  if (feet <= 0.02) return groundOwned(x, z);
  if (Math.abs(feet - BOX_HEIGHT) >= 0.02) return false;
  const index = DEV_OBSTACLES.findIndex(
    (box) =>
      Math.abs(x - box.x) <= BOX_WIDTH / 2 &&
      Math.abs(z - box.z) <= BOX_DEPTH / 2,
  );
  if (index < 0) return false;
  const box = DEV_OBSTACLES[index]!;
  return obstacleInk.sample(index, 4, x - box.x, box.z - z, color);
}
