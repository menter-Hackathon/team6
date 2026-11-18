import { useEffect, useRef, useState } from "react";
import { MicrophoneCapture } from "./capture";
import { SPEECH_SAMPLE_RATE } from "./audio";
import { RecognitionQueue, type RecognitionJob } from "./recognition-queue";
import type {
  SpeechRequest,
  SpeechResponse,
  Transcript,
  SpeechModelChoice,
} from "./protocol";
import { clearVoiced, reportMicRms } from "./voice-feedback";
type Phase = "idle" | "loading" | "ready" | "error";
export function useTranscription() {
  const [deviceId, setDeviceId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [model, setModel] = useState<SpeechModelChoice>("balanced");
  const [phase, setPhase] = useState<Phase>("idle"),
    [progress, setProgress] = useState(0);
  const [listening, setListening] = useState(false),
    [starting, setStarting] = useState(false);
  const [activity, setActivity] = useState({ level: 0, speaking: false });
  const [pending, setPending] = useState(0),
    [error, setError] = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]),
    [liveText, setLiveText] = useState("");
  const worker = useRef<Worker | null>(null),
    capture = useRef<MicrophoneCapture | null>(null);
  const queue = useRef(new RecognitionQueue());
  const alive = useRef(true),
    ready = useRef(false),
    generation = useRef(0),
    lastMeter = useRef(0);
  const currentUtterance = useRef(""),
    sealedUtterance = useRef("");
  async function refreshDevices() {
    try {
      const all = await navigator.mediaDevices?.enumerateDevices();
      if (alive.current && all)
        setDevices(
          all.filter(
            (device) =>
              device.kind === "audioinput" && device.deviceId !== "default",
          ),
        );
    } catch {
      /* Device selection stays at browser default. */
    }
  }
  function updatePending() {
    setPending(queue.current.size);
  }
  function pump() {
    if (!worker.current || !ready.current) return;
    const job = queue.current.next();
    if (!job) return;
    updatePending();
    worker.current.postMessage(
      {
        type: "transcribe",
        id: job.id,
        audio: job.audio,
      } satisfies SpeechRequest,
      [job.audio.buffer],
    );
  }
  function stop(flush = true) {
    const current = capture.current;
    capture.current = null;
    generation.current++;
    current?.stop(flush);
    clearVoiced();
    queue.current.discardDrafts();
    if (!flush) {
      currentUtterance.current = "";
      setLiveText("");
    }
    setListening(false);
    setStarting(false);
    setActivity({ level: 0, speaking: false });
    updatePending();
  }
  function submit(audio: Float32Array, utteranceId: string, final: boolean) {
    if (!alive.current || !ready.current) {
      audio.fill(0);
      return;
    }
    if (!final && sealedUtterance.current === utteranceId) {
      audio.fill(0);
      return;
    }
    if (currentUtterance.current !== utteranceId) {
      currentUtterance.current = utteranceId;
      setLiveText("");
    }
    if (final) sealedUtterance.current = utteranceId;
    const job: RecognitionJob = {
      id: crypto.randomUUID(),
      utteranceId,
      audio,
      final,
      durationMs: (audio.length / SPEECH_SAMPLE_RATE) * 1000,
    };
    if (!queue.current.add(job) && final)
      setError(
        "認識が追いつかず、この発話を確定できませんでした。少し待ってから話してください。",
      );
    updatePending();
    pump();
  }
  function resetWorker(next: Phase) {
    worker.current?.terminate();
    worker.current = null;
    ready.current = false;
    queue.current.clear();
    currentUtterance.current = "";
    sealedUtterance.current = "";
    setLiveText("");
    setPending(0);
    setPhase(next);
  }
  function acceptsPartial(job: RecognitionJob) {
    return (
      currentUtterance.current === job.utteranceId &&
      (job.final || sealedUtterance.current !== job.utteranceId)
    );
  }
  function prepare() {
    if (worker.current) return;
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
          stop(false);
          resetWorker("error");
          setError(message.message);
          return;
        }
        const active = queue.current.active;
        if (!active || !("id" in message) || message.id !== active.id) return;
        if (message.type === "partial") {
          if (acceptsPartial(active)) {
            setLiveText(message.text);
            window.dispatchEvent(
              new CustomEvent("interim-transcript", {
                detail: { text: message.text, id: active.utteranceId },
              }),
            );
          }
          return;
        }
        const job = queue.current.finish(message.id);
        if (!job) return;
        if (message.type === "error") {
          if (job.final) setError(message.message);
        } else if (message.type === "result") {
          if (!job.final) {
            if (acceptsPartial(job)) {
              setLiveText(message.text);
              window.dispatchEvent(
                new CustomEvent("interim-transcript", {
                  detail: { text: message.text, id: job.utteranceId },
                }),
              );
            }
          } else {
            if (currentUtterance.current === job.utteranceId) setLiveText("");
            if (message.text) {
              const transcript: Transcript = {
                id: job.utteranceId,
                text: message.text,
                source: "microphone",
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
              setError("言葉を認識できませんでした。もう一度話してください。");
          }
        }
        updatePending();
        pump();
      };
      instance.onerror = (event) => {
        event.preventDefault();
        if (worker.current !== instance || !alive.current) return;
        stop(false);
        resetWorker("error");
        setError(
          "音声認識を起動できませんでした。再度モデルを準備してください。",
        );
      };
      instance.postMessage({ type: "load", model } satisfies SpeechRequest);
    } catch {
      resetWorker("error");
      setError("このブラウザで音声認識を起動できませんでした。");
    }
  }
  async function start() {
    if (!ready.current || capture.current) return;
    setError("");
    setStarting(true);
    setLiveText("");
    currentUtterance.current = "";
    const current = new MicrophoneCapture(),
      version = ++generation.current,
      session = crypto.randomUUID();
    capture.current = current;
    try {
      await current.start(
        (audio, id) => submit(audio, `${session}:${id}`, true),
        (level, speaking, rms) => {
          if (!alive.current || capture.current !== current) return;
          reportMicRms(rms);
          if (performance.now() - lastMeter.current < 90) return;
          lastMeter.current = performance.now();
          setActivity({ level, speaking });
        },
        (audio, id) => {
          if (capture.current === current)
            submit(audio, `${session}:${id}`, false);
          else audio.fill(0);
        },
        deviceId || undefined,
      );
      void refreshDevices();
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
            : "マイクを開始できませんでした。HTTPSまたはlocalhostで開き、接続と権限を確認してください。",
      );
    }
  }
  useEffect(() => {
    alive.current = true;
    void refreshDevices();
    const changed = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener("devicechange", changed);
    const hide = () => {
      const current = capture.current;
      capture.current = null;
      generation.current++;
      current?.stop(false);
      queue.current.discardDrafts();
      currentUtterance.current = "";
      if (alive.current) {
        setListening(false);
        setStarting(false);
        setLiveText("");
        setActivity({ level: 0, speaking: false });
      }
    };
    window.addEventListener("pagehide", hide);
    return () => {
      alive.current = false;
      hide();
      worker.current?.terminate();
      worker.current = null;
      ready.current = false;
      queue.current.clear();
      window.removeEventListener("pagehide", hide);
      navigator.mediaDevices?.removeEventListener("devicechange", changed);
    };
  }, []);
  return {
    phase,
    deviceId,
    devices,
    changeDevice: (next: string) => {
      if (!listening && !starting) setDeviceId(next);
    },
    model,
    progress,
    listening,
    starting,
    activity,
    pending,
    error,
    transcripts,
    liveText,
    prepare,
    start,
    stop,
    changeModel: (next: SpeechModelChoice) => {
      if (starting || listening || pending || phase === "loading") return;
      stop(false);
      resetWorker("idle");
      setModel(next);
      setProgress(0);
      setError("");
    },
    clear: () => {
      setTranscripts([]);
      setLiveText("");
    },
    cancel: () => {
      resetWorker("idle");
      setError("");
    },
  };
}
