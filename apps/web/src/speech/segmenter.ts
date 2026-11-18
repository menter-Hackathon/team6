import { joinAudio, resampleAudio } from "./audio";

/** Preserve soft/short Japanese reactions: 60ms onset, 650ms silence, 500ms pre-roll. */
export class SpeechSegmenter {
  private pre: Float32Array[] = [];
  private chunks: Float32Array[] = [];
  private onset = 0;
  private voiced = 0;
  private silence = 0;
  private duration = 0;
  private utterance = 0;
  private previewAt = 0;
  speaking = false;
  level = 0;
  /** Latest chunk RMS; kept across flushes so callers can read it after push. */
  rms = 0;

  constructor(
    private readonly sampleRate: number,
    private readonly onSegment: (
      audio: Float32Array,
      utterance: number,
    ) => void,
    private readonly onPreview?: (
      audio: Float32Array,
      utterance: number,
    ) => void,
  ) {}

  push(samples: Float32Array): void {
    const seconds = samples.length / this.sampleRate;
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / Math.max(1, samples.length));
    this.rms = rms;
    this.level = Math.max(
      0,
      Math.min(1, (20 * Math.log10(rms + 1e-8) + 65) / 55),
    );
    const speech = rms >= 0.003;
    if (!this.speaking) {
      this.pre.push(samples);
      let size = this.pre.reduce((n, c) => n + c.length, 0);
      while (
        this.pre.length > 1 &&
        size - this.pre[0]!.length >= this.sampleRate * 0.5
      )
        size -= this.pre.shift()!.length;
      this.onset = speech ? this.onset + seconds : 0;
      if (this.onset < 0.06) return;
      this.speaking = true;
      this.utterance++;
      this.chunks = this.pre;
      this.pre = [];
      this.duration = size / this.sampleRate;
      this.voiced = this.onset;
      this.silence = 0;
    } else {
      this.chunks.push(samples);
      this.duration += seconds;
      if (speech) {
        this.voiced += seconds;
        this.silence = 0;
      } else this.silence += seconds;
    }
    if (this.silence >= 0.65 || this.duration >= 10) {
      this.flush();
      return;
    }
    if (
      this.onPreview &&
      this.voiced >= 0.1 &&
      this.duration >= 1.0 &&
      (this.previewAt === 0 || this.duration - this.previewAt >= 1.2)
    ) {
      this.previewAt = this.duration;
      this.onPreview(
        resampleAudio(joinAudio(this.chunks), this.sampleRate),
        this.utterance,
      );
    }
  }

  flush(): void {
    const chunks = this.chunks,
      voiced = this.voiced;
    const trim = Math.max(0, this.silence - 0.2);
    this.reset();
    if (voiced < 0.1 || !chunks.length) return;
    const audio = joinAudio(chunks);
    const length = Math.min(
      audio.length,
      Math.max(0, Math.floor(audio.length - trim * this.sampleRate)),
    );
    if (length)
      this.onSegment(
        resampleAudio(audio.subarray(0, length), this.sampleRate),
        this.utterance,
      );
  }

  reset(): void {
    this.pre = [];
    this.chunks = [];
    this.onset = this.voiced = this.silence = this.duration = 0;
    this.previewAt = 0;
    this.speaking = false;
    this.level = 0;
  }
}
