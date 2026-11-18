export const buttonInkInput = { active: false };

/** Latest local amplitude only; never contains audio or a classified paint request. */
export const voiceInput = { level: 0, speaking: false, at: 0 };
export function reportVoiceInput(level: number, speaking: boolean): void {
  voiceInput.level = Number.isFinite(level)
    ? Math.max(0, Math.min(1, level))
    : 0;
  voiceInput.speaking = speaking;
  voiceInput.at = performance.now();
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
