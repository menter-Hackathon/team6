/// <reference lib="webworker" />
import { prepareRecognitionAudio } from "./audio";
import { speechTextStreamer } from "./text-streamer";
import {
  env,
  pipeline,
  type WhisperTokenizer,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
import {
  WHISPER_MODELS,
  type SpeechModelChoice,
  type SpeechRequest,
  type SpeechResponse,
} from "./protocol";

const scope = self as unknown as DedicatedWorkerGlobalScope;
// Keep all audio local. Remote requests download public model/runtime files only.
env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let busy = false;
let model: SpeechModelChoice = "fast";
const progress = new Map<string, { loaded: number; total: number }>();
const post = (message: SpeechResponse) => scope.postMessage(message);

function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!recognizer) {
    recognizer = pipeline(
      "automatic-speech-recognition",
      WHISPER_MODELS[model],
      {
        device: "wasm",
        dtype: "q8",
        progress_callback: (event) => {
          if (event.status !== "progress") return;
          progress.set(event.file, {
            loaded: event.loaded,
            total: event.total,
          });
          const files = [...progress.values()],
            total = files.reduce((n, file) => n + file.total, 0);
          post({
            type: "progress",
            progress: total
              ? Math.min(
                  99,
                  (files.reduce((n, file) => n + file.loaded, 0) / total) * 100,
                )
              : 0,
          });
        },
      },
    ).catch((error) => {
      recognizer = null;
      progress.clear();
      throw error;
    });
  }
  return recognizer;
}

scope.addEventListener(
  "message",
  async (event: MessageEvent<SpeechRequest>) => {
    const request = event.data;
    try {
      if (request.type === "load") {
        model = request.model;
        await load();
        post({ type: "ready" });
        return;
      }
      if (busy) throw new Error("busy");
      busy = true;
      try {
        const transcribe = await load(),
          started = performance.now();
        prepareRecognitionAudio(request.audio);
        const streamer = speechTextStreamer(
          transcribe.tokenizer as WhisperTokenizer,
          (text) => post({ type: "partial", id: request.id, text }),
        );
        const output = await transcribe(request.audio, {
          streamer,
          language: "japanese",
          task: "transcribe",
          return_timestamps: false,
          max_new_tokens: 128,
        });
        const text =
          (Array.isArray(output) ? output[0]?.text : output.text) ?? "";
        post({
          type: "result",
          id: request.id,
          text: text.trim(),
          processingMs: performance.now() - started,
        });
      } finally {
        request.audio.fill(0);
        busy = false;
      }
    } catch {
      post({
        type: "error",
        ...(request.type === "transcribe" ? { id: request.id } : {}),
        message:
          request.type === "load"
            ? "認識モデルを準備できませんでした。接続を確認して再試行してください。"
            : "文字起こしに失敗しました。もう一度試してください。",
      });
    }
  },
);
