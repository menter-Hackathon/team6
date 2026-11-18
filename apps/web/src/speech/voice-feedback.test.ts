import { afterEach, describe, expect, it } from "vitest";
import {
  clearVoiced,
  isVoicedNow,
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
