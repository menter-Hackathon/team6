/**
 * Whether the local mic is hearing voice right now (D-085: 1.2x ink).
 * Holds only a timestamp; never audio, text, or a classification.
 */
/** Clear speech after autoGainControl sits well above this; room noise stays below. */
export const VOICED_RMS = 0.01;
/** Bridges gaps between capture chunks and brief dips between syllables. */
export const VOICED_HOLD_MS = 150;

/** Quiet gap after which the next voiced chunk counts as a new onset. */
const ONSET_GAP_MS = 300;

let voicedAt = -Infinity;
let onsetAt = -Infinity;
/** Onset of the voiced run that interim classification called a long sentence. */
let longRunOnset: number | null = null;

export function reportMicRms(rms: number, now = performance.now()): void {
  if (!Number.isFinite(rms) || rms < VOICED_RMS) return;
  if (now - voicedAt > ONSET_GAP_MS) onsetAt = now;
  voicedAt = now;
}

export function clearVoiced(): void {
  voicedAt = onsetAt = -Infinity;
  longRunOnset = null;
}

/** Start of the latest voiced run, for latency measurement. */
export function lastVoiceOnset(): number {
  return onsetAt;
}

export function isVoicedNow(now = performance.now()): boolean {
  return now - voicedAt <= VOICED_HOLD_MS;
}

/**
 * Interim classification says the sentence being spoken is long (長い文章).
 * Applies only to the current voiced run, so it ends on its own at the next pause.
 */
export function markLongSpeech(now = performance.now()): void {
  if (isVoicedNow(now)) longRunOnset = onsetAt;
}

/** Voice state for the next ink shot: undefined (silent), voiced, or long. */
export function currentInkVoice(
  now = performance.now(),
): "voiced" | "long" | undefined {
  if (!isVoicedNow(now)) return undefined;
  return longRunOnset === onsetAt ? "long" : "voiced";
}
