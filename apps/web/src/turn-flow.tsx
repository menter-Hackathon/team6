import { useEffect, useState } from "react";
import {
  PRESENTATION_SECONDS,
  PRESENTATION_TOPICS,
  TURN_INTRO_MS,
} from "@gaya/shared";

interface TurnFlowProps {
  speakerName: string;
  isYourTurn: boolean;
  turnNumber: number;
  turnCount: number;
  endsAt: number;
  topic?: string;
  preview?: boolean;
  onRerollTopic?: () => void;
  onClose?: () => void;
}

export function TurnFlow({
  speakerName,
  isYourTurn,
  turnNumber,
  turnCount,
  endsAt,
  topic,
  preview = false,
  onRerollTopic,
  onClose,
}: TurnFlowProps) {
  const [stage, setStage] = useState<"next" | "presentation" | "timer">("next");
  const [remaining, setRemaining] = useState(PRESENTATION_SECONDS);
  const activeTopic = topic?.trim() || PRESENTATION_TOPICS[0];

  useEffect(() => {
    const presentationTimer = window.setTimeout(
      () => setStage("presentation"),
      1000,
    );
    const moveTimer = window.setTimeout(
      () => setStage("timer"),
      TURN_INTRO_MS - 650,
    );
    const countdownStartsAt = Date.now() + TURN_INTRO_MS;
    const clock = window.setInterval(() => {
      if (Date.now() >= countdownStartsAt) {
        setRemaining(
          Math.max(
            0,
            Math.min(
              PRESENTATION_SECONDS,
              Math.ceil((endsAt - Date.now()) / 1000),
            ),
          ),
        );
      }
    }, 100);
    return () => {
      window.clearTimeout(presentationTimer);
      window.clearTimeout(moveTimer);
      window.clearInterval(clock);
    };
  }, [endsAt]);

  return (
    <>
      {stage !== "timer" && (
        <div className="progression-backdrop progression-turn-backdrop">
          <section
            className={`progression-popup progression-turn-popup progression-turn-popup--${stage}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="turn-title"
          >
            {preview && (
              <span className="progression-preview">検証プレビュー</span>
            )}
            {preview && (
              <button
                className="progression-close"
                onClick={onClose}
                aria-label="ポップアップを閉じる"
              >
                ×
              </button>
            )}
            <p className="progression-kicker">
              PRESENTATION / {turnNumber} OF {turnCount}
            </p>
            <h2 id="turn-title">
              {isYourTurn
                ? "次はあなたのターン"
                : `次は${speakerName}さんのターン`}
            </h2>
            <div
              className={`turn-topic-card${stage === "presentation" ? " turn-presentation-enter" : ""}`}
              aria-hidden={stage === "next"}
            >
              <span className="turn-topic-label">TOPIC / トークテーマ</span>
              <p className="turn-topic-text">「{activeTopic}」</p>
            </div>
            <div
              className={`turn-intro-time${stage === "presentation" ? " turn-presentation-enter" : ""}`}
              aria-hidden={stage === "next"}
            >
              {remaining}
              <span>秒</span>
            </div>
            <p
              className={`turn-intro-hint${stage === "presentation" ? " turn-presentation-enter" : ""}`}
              aria-hidden={stage === "next"}
            >
              {isYourTurn
                ? "お題に沿って30秒で話してみよう！"
                : "話を聞いてガヤで盛り上げよう！"}
            </p>
          </section>
        </div>
      )}
      {stage === "timer" && (
        <div
          className="turn-timer"
          role="timer"
          aria-label={`発表の残り時間 ${remaining}秒`}
        >
          <span>
            {isYourTurn ? "あなたの発表" : `${speakerName}さんの発表`}
          </span>
          <strong>
            {remaining}
            <small>秒</small>
          </strong>
          <div className="turn-timer-topic" aria-label="現在のお題">
            <span className="turn-timer-topic-label">お題</span>
            <p className="turn-timer-topic-text">{activeTopic}</p>
          </div>
          {isYourTurn && onRerollTopic && (
            <button
              type="button"
              className="turn-topic-reroll"
              onClick={onRerollTopic}
            >
              別のお題にする
            </button>
          )}
          {preview && (
            <button
              type="button"
              className="turn-timer-close"
              onClick={onClose}
              aria-label="発表ターンのプレビューを閉じる"
            >
              ×
            </button>
          )}
        </div>
      )}
    </>
  );
}
