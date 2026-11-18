import { joinAudio, resampleAudio } from "./audio";

const SPEECH_RMS = 0.012;
const ONSET_SECONDS = 0.12;
const END_SILENCE_SECONDS = 0.35;
const PRE_ROLL_SECONDS = 0.25;
const MAX_SECONDS = 6;
const MIN_VOICED_SECONDS = 0.3;
/**
 * Aizuchi such as 「うん、うん、うん」: a short voiced burst followed by a brief dip
 * is emitted on its own so the first one can be judged without waiting for the rest.
 * Longer speech keeps the normal 350ms end-of-utterance rule.
 */
const SHORT_BURST_MAX_VOICED_SECONDS = 0.35;
const SHORT_BURST_GAP_SECONDS = 0.15;

/** Short utterances: 120ms onset, 350ms silence (150ms after a short burst), 250ms pre-roll, 6s maximum. */
export class SpeechSegmenter {
  private pre: Float32Array[] = [];
  private chunks: Float32Array[] = [];
  private onset = 0;
  private voiced = 0;
  private silence = 0;
  private duration = 0;
  speaking = false;
  /** Whether the latest chunk itself is above the speech threshold. */
  sounding = false;
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
    const speech = rms >= SPEECH_RMS;
    this.sounding = speech;
    if (!this.speaking) {
      this.pre.push(samples);
      let size = this.pre.reduce((n, c) => n + c.length, 0);
      while (
        this.pre.length > 1 &&
        size - this.pre[0]!.length >= this.sampleRate * PRE_ROLL_SECONDS
      )
        size -= this.pre.shift()!.length;
      this.onset = speech ? this.onset + seconds : 0;
      if (this.onset < ONSET_SECONDS) return;
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
    const shortBurst =
      this.voiced <= SHORT_BURST_MAX_VOICED_SECONDS &&
      this.silence >= SHORT_BURST_GAP_SECONDS;
    if (shortBurst) this.flush(ONSET_SECONDS);
    else if (
      this.silence >= END_SILENCE_SECONDS ||
      this.duration >= MAX_SECONDS
    )
      this.flush();
  }

  flush(minVoiced = MIN_VOICED_SECONDS): void {
    const chunks = this.chunks,
      voiced = this.voiced;
    const trim = Math.max(0, this.silence - 0.12);
    this.reset();
    // Tolerate float accumulation of chunk durations at the threshold.
    if (voiced < minVoiced - 1e-6 || !chunks.length) return;
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
    this.sounding = false;
    this.level = 0;
  }
}
