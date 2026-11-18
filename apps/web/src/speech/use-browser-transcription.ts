import { useEffect, useRef, useState } from "react";
import {
  BrowserRecognition,
  recognitionConstructor,
  type BrowserRecognitionState,
} from "./browser-recognition";
import type { Transcript } from "./protocol";

export function useBrowserTranscription() {
  const supported = typeof window !== "undefined" && !!recognitionConstructor();
  const [state, setState] = useState<BrowserRecognitionState>("off");
  const [speaking, setSpeaking] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [error, setError] = useState("");
  const recognition = useRef<BrowserRecognition | null>(null);
  function start() {
    const Recognition = recognitionConstructor();
    if (!Recognition || !window.isSecureContext) {
      setError(
        "この環境ではWeb Speech APIを利用できません。PC版ChromeでHTTPSまたはlocalhostを開いてください。",
      );
      return;
    }
    recognition.current ??= new BrowserRecognition(Recognition, {
      state: setState,
      speaking: setSpeaking,
      partial: setLiveText,
      interim: (text, id) =>
        window.dispatchEvent(
          new CustomEvent("interim-transcript", { detail: { text, id } }),
        ),
      error: setError,
      final: (text, id) => {
        const transcript: Transcript = {
          id,
          text,
          source: "microphone",
          engine: "web-speech",
          durationMs: null,
          processingMs: null,
          createdAt: Date.now(),
        };
        setTranscripts((previous) => [transcript, ...previous].slice(0, 10));
        window.dispatchEvent(
          new CustomEvent<Transcript>("local-transcript", {
            detail: transcript,
          }),
        );
      },
    });
    recognition.current.start();
  }
  useEffect(() => {
    const hide = () => recognition.current?.cancel();
    window.addEventListener("pagehide", hide);
    return () => {
      hide();
      recognition.current = null;
      window.removeEventListener("pagehide", hide);
    };
  }, []);
  return {
    supported,
    phase: supported ? "ready" : "error",
    listening: state === "listening",
    starting: state === "starting",
    stopping: state === "stopping",
    activity: { speaking },
    pending: state === "stopping" ? 1 : 0,
    error,
    liveText,
    transcripts,
    start,
    stop: () => recognition.current?.stop(),
    cancel: () => recognition.current?.cancel(),
    clear: () => {
      setTranscripts([]);
      setLiveText("");
    },
  };
}
