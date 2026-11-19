import { describe, expect, it } from "vitest";
import { SpeechSegmenter } from "./segmenter";
import { joinAudio, resampleAudio, prepareRecognitionAudio } from "./audio";

const rate = 16000;
const frame = (value: number) => new Float32Array(320).fill(value);
const feed = (segmenter: SpeechSegmenter, frames: number, value: number) => {
  for (let i = 0; i < frames; i++) segmenter.push(frame(value));
};
describe("speech segmentation", () => {
  it("keeps a quiet 140ms reaction that the old volume and duration gates rejected", () => {
    const result: Float32Array[] = [];
    const vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 7, 0.004);
    feed(vad, 33, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.filter((sample) => sample > 0.003).length).toBe(7 * 320);
  });
  it("preserves quiet leading syllables and a natural half-second mid-sentence pause", () => {
    const result: Float32Array[] = [];
    const vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 5, 0.001);
    feed(vad, 12, 0.01);
    feed(vad, 25, 0);
    expect(result).toHaveLength(0);
    feed(vad, 12, 0.01);
    feed(vad, 33, 0);
    expect(result).toHaveLength(1);
    expect(result[0]![0]).toBeCloseTo(0.001);
    expect(result[0]!.filter((sample) => sample > 0.009).length).toBe(24 * 320);
  });
  it("emits evolving previews during speech and one final with the same utterance id", () => {
    const final: { audio: Float32Array; id: number }[] = [],
      drafts: { audio: Float32Array; id: number }[] = [];
    const vad = new SpeechSegmenter(
      rate,
      (audio, id) => final.push({ audio, id }),
      (audio, id) => drafts.push({ audio, id }),
    );
    feed(vad, 140, 0.04);
    expect(final).toHaveLength(0);
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    expect(drafts[1]!.audio.length).toBeGreaterThan(drafts[0]!.audio.length);
    feed(vad, 33, 0);
    expect(final).toHaveLength(1);
    expect(drafts.every((draft) => draft.id === final[0]!.id)).toBe(true);
    const first = drafts[0]!.audio.slice();
    feed(vad, 40, 0.04);
    vad.flush();
    expect(final[1]!.id).not.toBe(final[0]!.id);
    expect(drafts[0]!.audio).toEqual(first);
  });
  it("does not emit new previews after reset or for short noise", () => {
    const preview: Float32Array[] = [];
    const vad = new SpeechSegmenter(
      rate,
      () => {},
      (audio) => preview.push(audio),
    );
    feed(vad, 2, 0.04);
    feed(vad, 60, 0);
    expect(preview).toHaveLength(0);
    feed(vad, 40, 0.04);
    const count = preview.length;
    vad.reset();
    feed(vad, 60, 0);
    expect(preview).toHaveLength(count);
  });
  it("ignores silence and short clicks instead of transcribing noise", () => {
    const result: Float32Array[] = [],
      vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 100, 0);
    feed(vad, 2, 0.03);
    feed(vad, 40, 0);
    vad.flush();
    expect(result).toHaveLength(0);
    expect(vad.speaking).toBe(false);
  });
  it("retains the beginning of speech and emits one utterance after silence", () => {
    const result: Float32Array[] = [],
      vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 20, 0);
    feed(vad, 25, 0.04);
    expect(vad.speaking).toBe(true);
    expect(result).toHaveLength(0);
    feed(vad, 32, 0);
    expect(result).toHaveLength(0);
    feed(vad, 1, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.filter((value) => value > 0.02).length).toBe(25 * 320);
    expect(result[0]!.length / rate).toBeLessThan(1.3);
    feed(vad, 100, 0);
    expect(result).toHaveLength(1);
  });
  it("keeps a short pause within one utterance while ending after a 650ms pause", () => {
    const result: Float32Array[] = [];
    const vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 20, 0.04);
    feed(vad, 12, 0);
    feed(vad, 20, 0.04);
    expect(result).toHaveLength(0);
    feed(vad, 33, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.filter((value) => value > 0.02).length).toBe(40 * 320);
  });
  it("bounds continuous speech to ten seconds and flushes the last utterance on stop", () => {
    const result: Float32Array[] = [],
      vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 550, 0.03);
    expect(result).toHaveLength(1);
    expect(result[0]!.length / rate).toBeLessThanOrEqual(10.03);
    vad.flush();
    expect(result).toHaveLength(2);
    vad.flush();
    expect(result).toHaveLength(2);
  });
  it("drops abandoned buffers on reset", () => {
    const result: Float32Array[] = [],
      vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 30, 0.03);
    vad.reset();
    vad.flush();
    expect(result).toHaveLength(0);
  });
});
describe("Whisper audio conversion", () => {
  it("preserves duration and averages samples when converting 48kHz to mono 16kHz", () => {
    const result = resampleAudio(
      new Float32Array([0, 0.3, 0.6, 0.3, 0.6, 0.9]),
      48000,
    );
    expect(result.length).toBe(2);
    expect(result[0]).toBeCloseTo(0.3);
    expect(result[1]).toBeCloseTo(0.6);
  });
  it("copies 16kHz data so transferring it cannot detach the capture buffer", () => {
    const original = frame(0.1),
      copy = resampleAudio(original, rate);
    expect(copy).toEqual(original);
    expect(copy.buffer).not.toBe(original.buffer);
    expect(joinAudio([copy, copy]).length).toBe(copy.length * 2);
  });
});

describe("recognition input gain", () => {
  it("raises quiet input with bounded gain and removes DC offset", () => {
    const audio = new Float32Array([0.05, 0.06, 0.05, 0.04]);
    prepareRecognitionAudio(audio);
    expect(Array.from(audio).reduce((a, b) => a + b, 0)).toBeCloseTo(0);
    expect(Math.max(...audio)).toBeCloseTo(0.04);
  });
  it("keeps peaks below clipping and leaves silent input silent", () => {
    const loud = new Float32Array([1, -1, 1, -1]);
    prepareRecognitionAudio(loud);
    expect(Math.max(...loud)).toBeCloseTo(0.85);
    const silence = new Float32Array(320);
    prepareRecognitionAudio(silence);
    expect(silence.every((sample) => sample === 0)).toBe(true);
  });
});
