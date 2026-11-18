import { useEffect, useRef, useState } from "react";
import { MicrophoneCapture } from "./capture";
import { monoAudio, resampleAudio, SPEECH_SAMPLE_RATE } from "./audio";
import type {
  SpeechRequest,
  SpeechResponse,
  Transcript,
  SpeechModelChoice,
} from "./protocol";

import { reportVoiceInput } from "./voice-feedback";

type Phase = "idle" | "loading" | "ready" | "error";
interface Job {
  id: string;
  audio: Float32Array;
  source: Transcript["source"];
  durationMs: number;
}
const MAX_PENDING = 3;

export function useTranscription() {
  const [model, setModel] = useState<SpeechModelChoice>("fast");
  const [phase, setPhase] = useState<Phase>("idle"),
    [progress, setProgress] = useState(0);
  const [listening, setListening] = useState(false),
    [starting, setStarting] = useState(false);
  const [activity, setActivity] = useState({ level: 0, speaking: false });
  const [pending, setPending] = useState(0),
    [error, setError] = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]),
    [decoding, setDecoding] = useState(false);
  const worker = useRef<Worker | null>(null),
    capture = useRef<MicrophoneCapture | null>(null);
  const queue = useRef<Job[]>([]),
    active = useRef<Job | null>(null);
  const alive = useRef(true),
    ready = useRef(false),
    generation = useRef(0);
  const fileContext = useRef<AudioContext | null>(null);
  const lastMeter = useRef(0);

  function updatePending() {
    setPending(queue.current.length + Number(active.current !== null));
  }
  function pump() {
    if (active.current || !worker.current || !ready.current) return;
    const job = queue.current.shift();
    if (!job) return;
    active.current = job;
    updatePending();
    const message: SpeechRequest = {
      type: "transcribe",
      id: job.id,
      audio: job.audio,
    };
    worker.current.postMessage(message, [job.audio.buffer]);
  }
  function stop(flush = true) {
    const current = capture.current;
    capture.current = null;
    generation.current++;
    current?.stop(flush);
    reportVoiceInput(0, false);
    setListening(false);
    setStarting(false);
    setActivity({ level: 0, speaking: false });
  }
  function submit(audio: Float32Array, source: Transcript["source"]) {
    if (!alive.current || !ready.current) return;
    if (queue.current.length + Number(active.current !== null) >= MAX_PENDING) {
      setError(
        "文字起こしが追いつかないため、この発話の認識をスキップしました。インク演出は続きます。",
      );
      return;
    }
    queue.current.push({
      id: crypto.randomUUID(),
      audio,
      source,
      durationMs: (audio.length / SPEECH_SAMPLE_RATE) * 1000,
    });
    setError("");
    updatePending();
    pump();
  }
  function resetWorker(nextPhase: Phase) {
    worker.current?.terminate();
    worker.current = null;
    ready.current = false;
    queue.current = [];
    active.current = null;
    setPending(0);
    setPhase(nextPhase);
  }
  function prepare() {
    if (worker.current || phase === "loading") return;
    setPhase("loading");
    setProgress(0);
    setError("");
    try {
      const instance = new Worker(
        new URL("./transcription.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<SpeechResponse>) => {
        if (!alive.current || worker.current !== instance) return;
        const message = event.data;
        if (message.type === "progress") {
          setProgress(message.progress);
          return;
        }
        if (message.type === "ready") {
          ready.current = true;
          setPhase("ready");
          setProgress(100);
          return;
        }
        if (message.type === "error" && !message.id) {
          resetWorker("error");
          setError(message.message);
          return;
        }
        if (
          (message.type === "result" || message.type === "error") &&
          message.id === active.current?.id
        ) {
          const job = active.current;
          if (!job) return;
          active.current = null;
          if (message.type === "error") setError(message.message);
          else if (message.text) {
            const transcript: Transcript = {
              id: job.id,
              text: message.text,
              source: job.source,
              durationMs: job.durationMs,
              processingMs: message.processingMs,
              createdAt: Date.now(),
            };
            setTranscripts((previous) =>
              [transcript, ...previous].slice(0, 10),
            );
            window.dispatchEvent(
              new CustomEvent<Transcript>("local-transcript", {
                detail: transcript,
              }),
            );
          } else
            setError(
              "言葉を認識できませんでした。少しはっきり話してみてください。",
            );
          updatePending();
          pump();
        }
      };
      instance.onerror = (event) => {
        event.preventDefault();
        if (!alive.current || worker.current !== instance) return;
        resetWorker("error");
        setError(
          "音声認識を起動できませんでした。ページを再読み込みして、もう一度準備してください。",
        );
      };
      instance.postMessage({ type: "load", model } satisfies SpeechRequest);
    } catch {
      resetWorker("error");
      setError("このブラウザで音声認識を起動できませんでした。");
    }
  }
  async function start() {
    if (capture.current) return;
    setError("");
    setStarting(true);
    const current = new MicrophoneCapture(),
      version = ++generation.current;
    capture.current = current;
    try {
      await current.start(
        (audio) => submit(audio, "microphone"),
        (level, speaking) => {
          if (!alive.current || capture.current !== current) return;
          reportVoiceInput(level, speaking);
          if (performance.now() - lastMeter.current < 90) return;
          lastMeter.current = performance.now();
          setActivity({ level, speaking });
        },
      );
      if (!alive.current || version !== generation.current) {
        current.stop(false);
        return;
      }
      setListening(true);
      setStarting(false);
    } catch (reason) {
      if (!alive.current || version !== generation.current) return;
      capture.current = null;
      setStarting(false);
      setListening(false);
      const name = reason instanceof DOMException ? reason.name : "";
      setError(
        name === "NotAllowedError"
          ? "マイクが許可されていません。ブラウザのマイク設定を確認してください。"
          : name === "NotFoundError"
            ? "マイクが見つかりません。接続を確認してください。"
            : "マイクを開始できませんでした。HTTPSまたはlocalhostで開き、マイクの接続・権限を確認してください。",
      );
    }
  }
  async function transcribeFile(file: File) {
    if (!ready.current || decoding) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("20MB以下の音声ファイルを選んでください。");
      return;
    }
    const version = generation.current;
    setDecoding(true);
    setError("");
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      fileContext.current = context;
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      if (!alive.current || version !== generation.current) return;
      if (decoded.duration > 30) {
        setError("30秒以内の音声ファイルを選んでください。");
        return;
      }
      submit(resampleAudio(monoAudio(decoded), decoded.sampleRate), "file");
    } catch {
      if (alive.current)
        setError(
          "音声ファイルを読み込めませんでした。WAVやMP3などで試してください。",
        );
    } finally {
      if (context && context.state !== "closed")
        await context.close().catch(() => {});
      if (fileContext.current === context) fileContext.current = null;
      if (alive.current) setDecoding(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    const pageHide = () => {
      capture.current?.stop(false);
      capture.current = null;
      reportVoiceInput(0, false);
    };
    window.addEventListener("pagehide", pageHide);
    return () => {
      alive.current = false;
      generation.current++;
      pageHide();
      worker.current?.terminate();
      worker.current = null;
      if (fileContext.current?.state !== "closed")
        void fileContext.current?.close().catch(() => {});
      window.removeEventListener("pagehide", pageHide);
    };
  }, []);

  return {
    phase,
    model,
    changeModel: (next: SpeechModelChoice) => {
      if (starting || listening || decoding || pending || phase === "loading")
        return;
      stop(false);
      resetWorker("idle");
      setModel(next);
      setProgress(0);
      setError("");
    },
    progress,
    listening,
    starting,
    activity,
    pending,
    error,
    transcripts,
    decoding,
    prepare,
    start,
    stop,
    transcribeFile,
    clear: () => setTranscripts([]),
    cancel: () => {
      resetWorker("idle");
      setError("");
    },
  };
}
