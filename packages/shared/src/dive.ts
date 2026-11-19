import { DIVE_GAP_SECONDS, NEON_COLORS } from "./index.js";

export interface DiveState {
  submerged: boolean;
  gapSeconds: number;
  team: number;
}

/** One simulation step; only owned paint can refill the short gap allowance. */
export function updateDiveState(
  previous: DiveState,
  requested: boolean,
  owned: boolean,
  delta: number,
  team: number,
): DiveState {
  if (
    !requested ||
    !Number.isInteger(team) ||
    team < 1 ||
    team > NEON_COLORS.length
  )
    return { submerged: false, gapSeconds: 0, team };
  if (owned) return { submerged: true, gapSeconds: DIVE_GAP_SECONDS, team };
  const remaining =
    previous.team === team
      ? Math.max(0, previous.gapSeconds - Math.max(0, delta))
      : 0;
  return { submerged: remaining > 1e-6, gapSeconds: remaining, team };
}
