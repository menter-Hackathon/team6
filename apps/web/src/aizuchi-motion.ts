export const AIZUCHI_MOTION_SECONDS = 0.5;
export const AIZUCHI_LAND_TIME = 0.32;
/** Shrink the whole cube, spring larger, then settle; only the mesh moves. */
export function aizuchiPose(age: number) {
  if (age < 0 || age >= AIZUCHI_MOTION_SECONDS)
    return { scaleY: 1, width: 1, size: 1, height: 0, pitch: 0, roll: 0 };
  const keys = [
    [0, 1, 1],
    [0.07, 0.58, 0.75],
    [0.16, 1.4, 1.18],
    [0.26, 0.98, 0.98],
    [0.36, 1.035, 1.03],
    [0.5, 1, 1],
  ] as const;
  let size = 1,
    scaleY = 1;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!,
      b = keys[i]!;
    if (age <= b[0]) {
      const u = (age - a[0]) / (b[0] - a[0]),
        ease = u * u * (3 - 2 * u);
      size = a[1] + (b[1] - a[1]) * ease;
      scaleY = a[2] + (b[2] - a[2]) * ease;
      break;
    }
  }
  const flight = Math.max(
    0,
    Math.min(1, (age - 0.07) / (AIZUCHI_LAND_TIME - 0.07)),
  );
  return {
    size,
    scaleY,
    width: 1 / Math.sqrt(scaleY),
    pitch: 0,
    height: 0.85 * Math.sin(Math.PI * flight) ** 1.4,
    roll: 0,
  };
}
