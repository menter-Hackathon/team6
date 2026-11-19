import { TABLE_RADIUS } from "@gaya/shared";
import { describe, expect, it } from "vitest";
import {
  FIELD_HALF_WIDTH,
  FIELD_HALF_DEPTH,
  PLAYER_RADIUS,
} from "@gaya/shared";
import { movePlayer } from "./movement.js";

describe("movePlayer", () => {
  it("normalizes diagonal movement", () => {
    const moved = movePlayer(
      { x: 0, z: 0 },
      { sequence: 1, x: 1, z: 1, yaw: 0, dive: false },
      1,
    );
    expect(Math.hypot(moved.x, moved.z)).toBeCloseTo(5);
  });

  it("keeps the player inside the field", () => {
    const moved = movePlayer(
      { x: FIELD_HALF_WIDTH, z: FIELD_HALF_DEPTH },
      { sequence: 1, x: 1, z: 1, yaw: 0, dive: false },
      1,
    );
    expect(moved.x).toBe(FIELD_HALF_WIDTH - PLAYER_RADIUS);
    expect(moved.z).toBe(FIELD_HALF_DEPTH - PLAYER_RADIUS);
  });
});

it("blocks running and diving through a classroom table", () => {
  for (const dive of [false, true]) {
    const result = movePlayer(
      { x: -8, z: -29 },
      { sequence: 1, x: 0, z: 1, yaw: 0, dive },
      1,
      7.5,
    );
    expect(result.z).toBeCloseTo(-24 - TABLE_RADIUS - PLAYER_RADIUS);
  }
});
