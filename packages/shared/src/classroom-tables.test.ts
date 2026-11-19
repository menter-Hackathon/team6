import { TABLE_RADIUS } from "./classroom-tables.js";
import { describe, expect, it } from "vitest";
import {
  CLASSROOM_TABLES,
  TABLE_WIDTH,
  TABLE_DEPTH,
  moveAroundTables,
} from "./classroom-tables.js";
import {
  FIELD_HALF_WIDTH,
  FIELD_HALF_DEPTH,
  teamStartPosition,
} from "./index.js";

describe("classroom table obstacles", () => {
  it("places eight separate tables inside the room, leaving starts and a central aisle clear", () => {
    expect(CLASSROOM_TABLES).toHaveLength(8);
    expect(new Set(CLASSROOM_TABLES.map((table) => table.id)).size).toBe(8);
    for (const table of CLASSROOM_TABLES) {
      expect(Math.abs(table.x) + TABLE_WIDTH / 2).toBeLessThan(
        FIELD_HALF_WIDTH - 2,
      );
      expect(Math.abs(table.z) + TABLE_DEPTH / 2).toBeLessThan(
        FIELD_HALF_DEPTH - 3,
      );
    }
    expect(moveAroundTables({ x: 0, z: -35 }, { x: 0, z: 35 }).z).toBeCloseTo(
      35,
    );
    for (const team of ["A", "B"] as const)
      for (let index = 0; index < 4; index++) {
        const start = teamStartPosition(team, index, 4);
        expect(
          moveAroundTables(start, { x: start.x, z: start.z + 0.1 }),
        ).toEqual({ x: start.x, z: start.z + 0.1 });
      }
  });
  it("stops on every side of a table, including long moves and submerged movement", () => {
    const table = CLASSROOM_TABLES[0]!;
    const left = table.x - TABLE_WIDTH / 2 - 0.45,
      right = table.x + TABLE_WIDTH / 2 + 0.45;
    const near = table.z - TABLE_DEPTH / 2 - 0.45,
      far = table.z + TABLE_DEPTH / 2 + 0.45;
    expect(
      moveAroundTables(
        { x: table.x - 6, z: table.z },
        { x: table.x + 6, z: table.z },
      ).x,
    ).toBeCloseTo(left);
    expect(
      moveAroundTables(
        { x: table.x + 6, z: table.z },
        { x: table.x - 6, z: table.z },
      ).x,
    ).toBeCloseTo(right);
    expect(
      moveAroundTables(
        { x: table.x, z: table.z - 5 },
        { x: table.x, z: table.z + 5 },
      ).z,
    ).toBeCloseTo(near);
    expect(
      moveAroundTables(
        { x: table.x, z: table.z + 5 },
        { x: table.x, z: table.z - 5 },
      ).z,
    ).toBeCloseTo(far);
  });
  it("slides around the circular edge while preventing diagonal entry", () => {
    const table = CLASSROOM_TABLES[0]!;
    const moved = moveAroundTables(
      { x: table.x - (TABLE_RADIUS + 0.45), z: table.z },
      { x: table.x - (TABLE_RADIUS - 0.55), z: table.z + 1 },
    );
    expect(
      Math.hypot(moved.x - table.x, moved.z - table.z),
    ).toBeGreaterThanOrEqual(TABLE_RADIUS + 0.45 - 1e-8);
    expect(moved.z).toBeGreaterThan(table.z + 0.9);
    const diagonal = moveAroundTables(
      { x: table.x - 5, z: table.z - 4 },
      { x: table.x, z: table.z },
    );
    expect(Math.hypot(diagonal.x - table.x, diagonal.z - table.z)).toBeCloseTo(
      TABLE_RADIUS + 0.45,
    );
  });
});

import { moveOnTables, TABLE_HEIGHT } from "./classroom-tables.js";
it("requires painted cloth to climb, then keeps moving across the top with Shift held", () => {
  let player = { x: 8, z: 9 - (TABLE_RADIUS + 0.45), height: 0 };
  const target = () => ({ x: player.x, z: player.z + 0.15 });
  const blocked = moveOnTables(player, target(), true, 0.05, () => false);
  expect(blocked.height).toBe(0);
  expect(blocked.z).toBeCloseTo(player.z);
  for (let i = 0; i < 12; i++)
    player = moveOnTables(player, target(), true, 0.05, () => true);
  expect(player.height).toBe(TABLE_HEIGHT);
  const landedZ = player.z;
  player = moveOnTables(player, target(), true, 0.05, () => true);
  expect(player.z).toBeGreaterThan(landedZ);
  expect(player.height).toBe(TABLE_HEIGHT);
});
it("drops when Shift is released halfway up and when walking off the top", () => {
  const stopped = moveOnTables(
    { x: 8, z: 9 - (TABLE_RADIUS + 0.45), height: 0.8 },
    { x: 8, z: 9 - (TABLE_RADIUS + 0.45) },
    false,
    0.1,
    () => true,
  );
  expect(stopped.height).toBeLessThan(0.8);
  const edge = moveOnTables(
    { x: 8, z: 9 + TABLE_RADIUS - 0.1, height: TABLE_HEIGHT },
    { x: 8, z: 9 + TABLE_RADIUS + 0.5 },
    true,
    0.1,
    () => true,
  );
  expect(edge.height).toBeLessThan(TABLE_HEIGHT);
});
