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
  const x = -right * Math.cos(yaw) - forward * Math.sin(yaw);
  const z = -right * Math.sin(yaw) + forward * Math.cos(yaw);
  const scale = Math.max(1, Math.hypot(x, z));
  return {
    x: Math.max(-1, Math.min(1, x / scale)),
    z: Math.max(-1, Math.min(1, z / scale)),
  };
}
