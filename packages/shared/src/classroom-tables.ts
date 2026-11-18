export const TABLE_RADIUS = 3.2;
export const TABLE_WIDTH = TABLE_RADIUS * 2;
export const TABLE_DEPTH = TABLE_RADIUS * 2;
export const TABLE_HEIGHT = 1.6;
export const CLASSROOM_TABLES = [-24, -9, 9, 24].flatMap((z, row) =>
  [-8, 8].map((x, column) => ({ id: `table-${row}-${column}`, x, z })),
);

/** Circular solid tables, with short steps and radial projection to slide around cloth. */
export function moveAroundTables(
  from: { x: number; z: number },
  to: { x: number; z: number },
  radius = 0.45,
) {
  const count = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.25),
  );
  const dx = (to.x - from.x) / count,
    dz = (to.z - from.z) / count;
  let collided = false;
  let x = from.x,
    z = from.z;
  for (let step = 0; step < count; step++) {
    const oldX = x,
      oldZ = z;
    x += dx;
    z += dz;
    for (const table of CLASSROOM_TABLES) {
      let nx = x - table.x,
        nz = z - table.z;
      let length = Math.hypot(nx, nz);
      const limit = TABLE_RADIUS + radius;
      if (length >= limit) continue;
      collided = true;
      if (length < 1e-8) {
        nx = oldX - table.x;
        nz = oldZ - table.z;
        length = Math.hypot(nx, nz);
      }
      if (length < 1e-8) {
        nx = 1;
        nz = 0;
        length = 1;
      }
      x = table.x + (nx / length) * limit;
      z = table.z + (nz / length) * limit;
    }
  }
  return collided ? { x, z } : { x: to.x, z: to.z };
}

export function tableFloorHeight(x: number, z: number, height: number) {
  return height >= TABLE_HEIGHT - 0.03 &&
    CLASSROOM_TABLES.some(
      (table) => Math.hypot(x - table.x, z - table.z) < TABLE_RADIUS + 0.15,
    )
    ? TABLE_HEIGHT
    : 0;
}
export function moveOnTables(
  from: { x: number; z: number; height: number },
  to: { x: number; z: number },
  diving: boolean,
  dt: number,
  owns: (
    table: number,
    x: number,
    y: number,
    surface: "side" | "top",
  ) => boolean,
) {
  const solid = from.height < TABLE_HEIGHT - 0.03;
  const moved = solid ? moveAroundTables(from, to) : to;
  if (diving && solid)
    for (let index = 0; index < CLASSROOM_TABLES.length; index++) {
      const table = CLASSROOM_TABLES[index]!,
        dx = from.x - table.x,
        dz = from.z - table.z,
        length = Math.hypot(dx, dz);
      if (length < TABLE_RADIUS + 0.1 || length > TABLE_RADIUS + 0.72) continue;
      const nx = dx / length,
        nz = dz / length;
      if ((to.x - from.x) * nx + (to.z - from.z) * nz >= -0.0001) continue;
      const angle = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2);
      if (
        !owns(
          index,
          angle * TABLE_RADIUS,
          Math.min(TABLE_HEIGHT - 0.15, from.height + 0.6),
          "side",
        )
      )
        continue;
      const height = from.height + 3 * Math.min(dt, 0.1);
      if (height >= TABLE_HEIGHT - 0.35)
        return {
          x: table.x + nx * (TABLE_RADIUS - 0.5),
          z: table.z + nz * (TABLE_RADIUS - 0.5),
          height: TABLE_HEIGHT,
          climbing: false,
        };
      return {
        x: table.x + nx * (TABLE_RADIUS + 0.45),
        z: table.z + nz * (TABLE_RADIUS + 0.45),
        height,
        climbing: true,
      };
    }
  const floor = tableFloorHeight(moved.x, moved.z, from.height);
  return {
    ...moved,
    height: Math.max(floor, from.height - 5 * Math.min(dt, 0.1)),
    climbing: false,
  };
}
