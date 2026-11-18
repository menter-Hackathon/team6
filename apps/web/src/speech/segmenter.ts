import { joinAudio, resampleAudio } from "./audio";

/** Short utterances: 120ms onset, 350ms silence, 250ms pre-roll, 6s maximum. */
export class SpeechSegmenter {
  private pre: Float32Array[] = [];
  private chunks: Float32Array[] = [];
  private onset = 0;
  private voiced = 0;
  private silence = 0;
  private duration = 0;
  speaking = false;
  level = 0;

  constructor(
    private readonly sampleRate: number,
    private readonly onSegment: (audio: Float32Array) => void,
  ) {}

  push(samples: Float32Array): void {
    const seconds = samples.length / this.sampleRate;
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / Math.max(1, samples.length));
    this.level = Math.min(1, rms * 12);
    const speech = rms >= 0.012;
    if (!this.speaking) {
      this.pre.push(samples);
      let size = this.pre.reduce((n, c) => n + c.length, 0);
      while (
        this.pre.length > 1 &&
        size - this.pre[0]!.length >= this.sampleRate * 0.25
      )
        size -= this.pre.shift()!.length;
      this.onset = speech ? this.onset + seconds : 0;
      if (this.onset < 0.12) return;
      this.speaking = true;
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
    if (this.silence >= 0.35 || this.duration >= 6) this.flush();
  }

  flush(): void {
    const chunks = this.chunks,
      voiced = this.voiced;
    const trim = Math.max(0, this.silence - 0.12);
    this.reset();
    if (voiced < 0.3 || !chunks.length) return;
    const audio = joinAudio(chunks);
    const length = Math.min(
      audio.length,
      Math.max(0, Math.floor(audio.length - trim * this.sampleRate)),
    );
    if (length)
      this.onSegment(resampleAudio(audio.subarray(0, length), this.sampleRate));
  }

  reset(): void {
    this.pre = [];
    this.chunks = [];
    this.onset = this.voiced = this.silence = this.duration = 0;
    this.speaking = false;
    this.level = 0;
  }
}
