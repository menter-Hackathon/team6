export interface WorldDirection {
  x: number;
  z: number;
}

const FULL_TURN = Math.PI * 2;

export function rotateYaw(
  yaw: number,
  movementX: number,
  sensitivity = 0.0025,
): number {
  return (
    ((((yaw + movementX * sensitivity + Math.PI) % FULL_TURN) + FULL_TURN) %
      FULL_TURN) -
    Math.PI
  );
}

export function toModelRotation(yaw: number): number {
  return -yaw;
}

export function toWorldDirection(
  forward: number,
  right: number,
  yaw: number,
): WorldDirection {
  return {
    x: -right * Math.cos(yaw) - forward * Math.sin(yaw),
    z: -right * Math.sin(yaw) + forward * Math.cos(yaw),
  };
}
