/**
 * Whether the local mic is hearing voice right now (D-085: 1.2x ink).
 * Holds only a timestamp; never audio, text, or a classification.
 */
/** Clear speech after autoGainControl sits well above this; room noise stays below. */
export const VOICED_RMS = 0.01;
/** Bridges gaps between capture chunks and brief dips between syllables. */
export const VOICED_HOLD_MS = 150;

let voicedAt = -Infinity;

export function reportMicRms(rms: number, now = performance.now()): void {
  if (Number.isFinite(rms) && rms >= VOICED_RMS) voicedAt = now;
}

export function clearVoiced(): void {
  voicedAt = -Infinity;
}

export function isVoicedNow(now = performance.now()): boolean {
  return now - voicedAt <= VOICED_HOLD_MS;
}
