import workletUrl from "./capture.worklet.js?url";
import { SpeechSegmenter } from "./segmenter";

export class MicrophoneCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private segmenter: SpeechSegmenter | null = null;
  private stopped = false;

  async start(
    onSegment: (audio: Float32Array, utterance: number) => void,
    onActivity: (level: number, speaking: boolean, rms: number) => void,
    onPreview?: (audio: Float32Array, utterance: number) => void,
    deviceId?: string,
  ): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error("secure-context");
    try {
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      if (this.stopped) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          autoGainControl: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      if (this.stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      await context.audioWorklet.addModule(workletUrl);
      if (this.stopped) return;
      const segmenter = new SpeechSegmenter(
        context.sampleRate,
        onSegment,
        onPreview,
      );
      this.segmenter = segmenter;
      const node = new AudioWorkletNode(context, "speech-capture");
      this.node = node;
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (this.stopped) return;
        segmenter.push(event.data);
        onActivity(segmenter.level, segmenter.speaking, segmenter.rms);
      };
      const mute = context.createGain();
      mute.gain.value = 0;
      context.createMediaStreamSource(stream).connect(node);
      node.connect(mute);
      mute.connect(context.destination);
    } catch (error) {
      this.stop(false);
      throw error;
    }
  }

  stop(flush = true): void {
    this.stopped = true;
    if (flush) this.segmenter?.flush();
    else this.segmenter?.reset();
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.disconnect();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.node = null;
    this.stream = null;
    this.context = null;
  }
}
