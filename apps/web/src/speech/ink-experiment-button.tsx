import { useEffect, useState } from "react";
import { buttonInkInput } from "./voice-feedback";
import "./transcription.css";

export function InkExperimentButton() {
  const [pressed, setPressed] = useState(false);
  const setActive = (active: boolean) => {
    buttonInkInput.active = active;
    setPressed(active);
  };
  useEffect(() => {
    const stop = () => {
      buttonInkInput.active = false;
      setPressed(false);
    };
    const hide = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hide);
    return () => {
      buttonInkInput.active = false;
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  return (
    <button
      className="ink-experiment-button"
      aria-label="押している間インク発射（実験）"
      data-active={pressed}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(true);
      }}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      onLostPointerCapture={() => setActive(false)}
      onBlur={() => setActive(false)}
      onKeyDown={(event) => {
        if (event.code !== "Space" && event.code !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        setActive(true);
      }}
      onKeyUp={(event) => {
        if (event.code !== "Space" && event.code !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        setActive(false);
      }}
    >
      {pressed ? "インク発射中！" : "押している間 インク発射"}
      <small>実験用 · 塗りには影響しません</small>
    </button>
  );
}
