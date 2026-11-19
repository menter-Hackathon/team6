import {
  moveAroundTables,
  TABLE_HEIGHT,
  FIELD_HALF_WIDTH,
  FIELD_HALF_DEPTH,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  DIVE_SPEED,
  DISC_SPEED,
  type MoveInput,
} from "@gaya/shared";

export interface Position {
  x: number;
  z: number;
  height?: number;
}

export function movePlayer(
  position: Position,
  input: MoveInput,
  deltaSeconds: number,
  speed = input.dive ? DISC_SPEED : PLAYER_SPEED,
  collideTables = true,
): Position {
  const length = Math.hypot(input.x, input.z);
  const scale = length > 1 ? 1 / length : 1;
  const xLimit = FIELD_HALF_WIDTH - PLAYER_RADIUS;
  const zLimit = FIELD_HALF_DEPTH - PLAYER_RADIUS;

  const target = {
    x: Math.max(
      -xLimit,
      Math.min(xLimit, position.x + input.x * scale * speed * deltaSeconds),
    ),
    z: Math.max(
      -zLimit,
      Math.min(zLimit, position.z + input.z * scale * speed * deltaSeconds),
    ),
  };
  return !collideTables || (position.height ?? 0) >= TABLE_HEIGHT - 0.03
    ? target
    : moveAroundTables(position, target, PLAYER_RADIUS);
}

export function movementSpeed(dive: boolean, onOwnPaint: boolean): number {
  return dive ? (onOwnPaint ? DIVE_SPEED : DISC_SPEED) : PLAYER_SPEED;
}
