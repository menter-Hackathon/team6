export const buttonInkInput = { active: false };

/** Latest local amplitude only; never contains audio or a classified paint request. */
export const voiceInput = {
  level: 0,
  speaking: false,
  at: 0,
  /** Last time a capture chunk was above the speech threshold. */
  soundingAt: -Infinity,
};
export function reportVoiceInput(
  level: number,
  speaking: boolean,
  sounding = false,
): void {
  const now = performance.now();
  voiceInput.level = Number.isFinite(level)
    ? Math.max(0, Math.min(1, level))
    : 0;
  voiceInput.speaking = speaking;
  voiceInput.at = now;
  if (sounding) voiceInput.soundingAt = now;
  else if (!speaking && voiceInput.level === 0)
    voiceInput.soundingAt = -Infinity;
}

/** Bridges the ~40ms gaps between capture chunks and brief dips between syllables. */
export const VOICED_HOLD_MS = 150;
/** True while the local mic is hearing voice right now (drives the 1.2x ink). */
export function isVoicedNow(now = performance.now()): boolean {
  return now - voiceInput.soundingAt <= VOICED_HOLD_MS;
}

/** Bounded cadence: no backlog, including after a suspended tab resumes. */
export class VoiceInkPulse {
  private cooldown = 0;
  update(
    delta: number,
    level: number,
    speaking: boolean,
    fresh: boolean,
  ): number | null {
    this.cooldown = Math.max(0, this.cooldown - Math.min(delta, 0.05));
    if (!fresh || !speaking || level <= 0 || !Number.isFinite(level)) {
      this.cooldown = 0;
      return null;
    }
    if (this.cooldown > 0) return null;
    const strength = Math.max(0, Math.min(1, level));
    this.cooldown = 0.16 - strength * 0.07;
    return strength;
  }
}
