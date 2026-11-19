export const SPECIAL_DURATION = 0.95;
export const SPECIAL_RADIUS = 3.4;

/** Negative time is idle; landing is emitted only once, with no cooldown. */
export function advanceSpecial(
  time: number,
  delta: number,
): { time: number; landed: boolean } {
  if (time < 0) return { time: -1, landed: false };
  const next = time + Math.max(0, delta);
  return next + 1e-6 >= SPECIAL_DURATION
    ? { time: -1, landed: true }
    : { time: next, landed: false };
}

export function specialPose(time: number): {
  height: number;
  spin: number;
  flip: number;
  scaleY: number;
} {
  const t = Math.max(0, Math.min(SPECIAL_DURATION, time));
  const charge = 0.12;
  if (t < charge)
    return {
      height: 0,
      spin: 0,
      flip: 0,
      scaleY: 1 - 0.18 * Math.sin((t / charge) * Math.PI),
    };
  const flight = (t - charge) / (SPECIAL_DURATION - charge);
  // Volume-preserving squash/stretch follows each phase of the jump.
  const shapes = [
    [0, 1],
    [0.12, 1.22],
    [0.42, 0.94],
    [0.58, 0.97],
    [0.86, 1.25],
    [1, 0.84],
  ] as const;
  let scaleY = 1;
  for (let i = 1; i < shapes.length; i++) {
    const start = shapes[i - 1]!,
      end = shapes[i]!;
    if (flight <= end[0]) {
      const u = Math.max(
        0,
        Math.min(1, (flight - start[0]) / (end[0] - start[0])),
      );
      const ease = u * u * (3 - 2 * u);
      scaleY = start[1] + (end[1] - start[1]) * ease;
      break;
    }
  }
  return {
    height: 2.15 * 4 * flight * (1 - flight),
    spin: flight * Math.PI * 4,
    flip: flight * Math.PI * 2,
    scaleY,
  };
}
