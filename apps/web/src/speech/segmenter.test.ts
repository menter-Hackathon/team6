import { describe, expect, it } from "vitest";
import { SpeechSegmenter } from "./segmenter";
import { joinAudio, resampleAudio } from "./audio";

const rate = 16000;
const frame = (value: number) => new Float32Array(320).fill(value);
const feed = (segmenter: SpeechSegmenter, frames: number, value: number) => {
  for (let i = 0; i < frames; i++) segmenter.push(frame(value));
};
describe("speech segmentation", () => {
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
    feed(vad, 17, 0);
    expect(result).toHaveLength(0);
    feed(vad, 1, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.filter((value) => value > 0.02).length).toBe(25 * 320);
    expect(result[0]!.length / rate).toBeLessThan(1);
    feed(vad, 100, 0);
    expect(result).toHaveLength(1);
  });
  it("keeps a short pause within one utterance while ending promptly at 350ms", () => {
    const result: Float32Array[] = [];
    const vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 20, 0.04);
    feed(vad, 12, 0);
    feed(vad, 20, 0.04);
    expect(result).toHaveLength(0);
    feed(vad, 18, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.filter((value) => value > 0.02).length).toBe(40 * 320);
  });
  it("bounds continuous speech to six seconds and flushes the last utterance on stop", () => {
    const result: Float32Array[] = [],
      vad = new SpeechSegmenter(rate, (audio) => result.push(audio));
    feed(vad, 330, 0.03);
    expect(result).toHaveLength(1);
    expect(result[0]!.length / rate).toBeLessThanOrEqual(6.03);
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
