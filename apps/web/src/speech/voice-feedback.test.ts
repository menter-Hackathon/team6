import { afterEach, describe, expect, it } from "vitest";
import {
  clearVoiced,
  currentInkVoice,
  isVoicedNow,
  markLongSpeech,
  reportMicRms,
  VOICED_HOLD_MS,
  VOICED_RMS,
} from "./voice-feedback";

describe("voiced state for 1.2x ink", () => {
  afterEach(clearVoiced);
  it("is quiet until the mic reports speech-level RMS", () => {
    expect(isVoicedNow(1000)).toBe(false);
    reportMicRms(VOICED_RMS / 2, 1000);
    expect(isVoicedNow(1000)).toBe(false);
    reportMicRms(VOICED_RMS, 1000);
    expect(isVoicedNow(1000)).toBe(true);
  });
  it("holds briefly across syllable gaps, then expires", () => {
    reportMicRms(0.05, 1000);
    expect(isVoicedNow(1000 + VOICED_HOLD_MS)).toBe(true);
    expect(isVoicedNow(1001 + VOICED_HOLD_MS)).toBe(false);
  });
  it("ignores invalid levels and clears on stop", () => {
    reportMicRms(Number.NaN, 1000);
    expect(isVoicedNow(1000)).toBe(false);
    reportMicRms(0.05, 1000);
    clearVoiced();
    expect(isVoicedNow(1000)).toBe(false);
  });
});

describe("long sentence state for 1.5x ink", () => {
  afterEach(clearVoiced);
  it("is silent, voiced, then long once interim classification says so", () => {
    expect(currentInkVoice(1000)).toBeUndefined();
    reportMicRms(0.05, 1000);
    expect(currentInkVoice(1000)).toBe("voiced");
    markLongSpeech(1100);
    reportMicRms(0.05, 1100);
    expect(currentInkVoice(1100)).toBe("long");
  });
  it("ends with the voiced run and does not carry into the next utterance", () => {
    reportMicRms(0.05, 1000);
    markLongSpeech(1000);
    expect(currentInkVoice(1100)).toBe("long");
    expect(currentInkVoice(1000 + VOICED_HOLD_MS + 1)).toBeUndefined();
    reportMicRms(0.05, 2000);
    expect(currentInkVoice(2000)).toBe("voiced");
  });
  it("ignores a long mark that arrives after speech already stopped", () => {
    reportMicRms(0.05, 1000);
    markLongSpeech(1000 + VOICED_HOLD_MS + 1);
    reportMicRms(0.05, 1200);
    expect(currentInkVoice(1200)).toBe("voiced");
  });
});
