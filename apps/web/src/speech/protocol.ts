export const WHISPER_MODEL = "onnx-community/whisper-base";
export type SpeechRequest =
  { type: "load" } | { type: "transcribe"; id: string; audio: Float32Array };
export type SpeechResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "result"; id: string; text: string; processingMs: number }
  | { type: "error"; id?: string; message: string };
export interface Transcript {
  id: string;
  text: string;
  source: "microphone" | "file";
  durationMs: number;
  processingMs: number;
  createdAt: number;
}
