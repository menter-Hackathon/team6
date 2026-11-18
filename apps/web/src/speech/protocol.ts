export const WHISPER_MODELS = {
  fast: "onnx-community/whisper-tiny",
  balanced: "onnx-community/whisper-base",
} as const;
export type SpeechModelChoice = keyof typeof WHISPER_MODELS;
export type SpeechRequest =
  | { type: "load"; model: SpeechModelChoice }
  | { type: "transcribe"; id: string; audio: Float32Array };
export type SpeechResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "partial"; id: string; text: string }
  | { type: "result"; id: string; text: string; processingMs: number }
  | { type: "error"; id?: string; message: string };
export interface Transcript {
  id: string;
  text: string;
  source: "microphone";
  engine?: "whisper" | "web-speech";
  durationMs: number | null;
  processingMs: number | null;
  createdAt: number;
}
