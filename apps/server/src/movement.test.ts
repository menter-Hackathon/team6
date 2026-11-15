import { describe, expect, it } from "vitest";
import { FIELD_HALF_SIZE, PLAYER_RADIUS } from "@gaya/shared";
import { movePlayer } from "./movement.js";

describe("movePlayer", () => {
  it("normalizes diagonal movement", () => {
    const moved = movePlayer(
      { x: 0, z: 0 },
      { sequence: 1, x: 1, z: 1, yaw: 0 },
      1,
    );
    expect(Math.hypot(moved.x, moved.z)).toBeCloseTo(5);
  });

  it("keeps the player inside the field", () => {
    const moved = movePlayer(
      { x: FIELD_HALF_SIZE, z: 0 },
      { sequence: 1, x: 1, z: 0, yaw: 0 },
      1,
    );
    expect(moved.x).toBe(FIELD_HALF_SIZE - PLAYER_RADIUS);
  });
});
