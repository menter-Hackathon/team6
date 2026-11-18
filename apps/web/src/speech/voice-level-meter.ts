import { clearVoiced, reportMicRms } from "./voice-feedback";

const SAMPLE_INTERVAL_MS = 40;

/**
 * Volume-only mic tap for engines that own their own capture (Web Speech).
 * Reads RMS for the 1.2x ink; never records, stores, or sends audio.
 */
export class VoiceLevelMeter {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private generation = 0;

  async start(): Promise<void> {
    if (this.stream || !navigator.mediaDevices?.getUserMedia) return;
    const version = ++this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    if (version !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    this.stream = stream;
    this.context = context;
    this.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      reportMicRms(Math.sqrt(sum / samples.length));
    }, SAMPLE_INTERVAL_MS);
  }

  stop(): void {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.stream = null;
    this.context = null;
    clearVoiced();
  }
}
