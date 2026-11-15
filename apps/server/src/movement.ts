import {
  FIELD_HALF_SIZE,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  type MoveInput,
} from "@gaya/shared";

export interface Position {
  x: number;
  z: number;
}

export function movePlayer(
  position: Position,
  input: MoveInput,
  deltaSeconds: number,
): Position {
  const length = Math.hypot(input.x, input.z);
  const scale = length > 1 ? 1 / length : 1;
  const limit = FIELD_HALF_SIZE - PLAYER_RADIUS;

  return {
    x: Math.max(
      -limit,
      Math.min(
        limit,
        position.x + input.x * scale * PLAYER_SPEED * deltaSeconds,
      ),
    ),
    z: Math.max(
      -limit,
      Math.min(
        limit,
        position.z + input.z * scale * PLAYER_SPEED * deltaSeconds,
      ),
    ),
  };
}
