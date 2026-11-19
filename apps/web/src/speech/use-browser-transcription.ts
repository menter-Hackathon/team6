import { useEffect, useRef, useState } from "react";
import {
  BrowserRecognition,
  recognitionConstructor,
  type BrowserRecognitionState,
} from "./browser-recognition";
import type { Transcript } from "./protocol";
import { VoiceLevelMeter } from "./voice-level-meter";

export function useBrowserTranscription() {
  const supported = typeof window !== "undefined" && !!recognitionConstructor();
  const [state, setState] = useState<BrowserRecognitionState>("off");
  const [speaking, setSpeaking] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [error, setError] = useState("");
  const recognition = useRef<BrowserRecognition | null>(null);
  // Web Speech owns its own capture, so the 1.2x ink reads volume separately.
  const meter = useRef<VoiceLevelMeter | null>(null);
  function start() {
    const Recognition = recognitionConstructor();
    if (!Recognition || !window.isSecureContext) {
      setError(
        "この環境ではWeb Speech APIを利用できません。PC版ChromeでHTTPSまたはlocalhostを開いてください。",
      );
      return;
    }
    recognition.current ??= new BrowserRecognition(Recognition, {
      state: (next) => {
        setState(next);
        if (next === "off") meter.current?.stop();
      },
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
    meter.current ??= new VoiceLevelMeter();
    // Without the meter, ink simply stays at the normal 0.9x.
    void meter.current.start().catch(() => meter.current?.stop());
  }
  useEffect(() => {
    const hide = () => {
      recognition.current?.cancel();
      meter.current?.stop();
    };
    window.addEventListener("pagehide", hide);
    return () => {
      hide();
      recognition.current = null;
      meter.current = null;
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
    stop: () => {
      recognition.current?.stop();
      meter.current?.stop();
    },
    cancel: () => {
      recognition.current?.cancel();
      meter.current?.stop();
    },
    clear: () => {
      setTranscripts([]);
      setLiveText("");
    },
  };
}
