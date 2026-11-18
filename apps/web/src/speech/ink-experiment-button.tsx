import { useEffect, useState } from "react";
import {
  REACTION_LEVELS,
  REACTION_SHORTCUTS,
  reactionForKey,
  previewReaction,
  type ReactionLevel,
} from "../reaction-preview";
import { buttonInkInput } from "./voice-feedback";
import "./transcription.css";

export function InkExperimentButton() {
  const [pressed, setPressed] = useState(false);
  const [selected, setSelected] = useState<ReactionLevel | null>(null);
  const preview = (level: ReactionLevel) => {
    buttonInkInput.active = false;
    setPressed(false);
    previewReaction(level);
    if (level === "返答") window.dispatchEvent(new Event("activate-special"));
    setSelected(level);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select"))
      )
        return;
      const level = reactionForKey(event.code);
      if (!level) return;
      event.preventDefault();
      preview(level);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
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
    <div className="ink-experiment-controls">
      <div className="reaction-preview-keys" aria-label="分類エフェクトの実験">
        {REACTION_LEVELS.map((level) => (
          <button
            key={level}
            aria-pressed={selected === level}
            onClick={() => preview(level)}
          >
            <kbd>{REACTION_SHORTCUTS[level]}</kbd> {level}
          </button>
        ))}
      </div>
      <p className="reaction-preview-status" role="status">
        {selected
          ? `${selected}${selected === "除外" ? "：インクなし" : " の演出"}`
          : "1〜5キーで演出を試せます（Fも返答）"}{" "}
        · 分類モデル未接続
      </p>
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
        {pressed ? "インク発射中！" : "通常インク（長押し）"}
        <small>1〜4は床に塗りが残ります · 5は発射なし</small>
      </button>
    </div>
  );
}
