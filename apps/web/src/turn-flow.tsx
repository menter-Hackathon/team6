import { useEffect, useState } from "react";
import { PRESENTATION_SECONDS, TURN_INTRO_MS } from "@gaya/shared";
import { InkCornerLogo } from "./ink-screen";

interface TurnFlowProps {
  speakerName: string;
  topic?: string;
  isYourTurn: boolean;
  turnNumber: number;
  turnCount: number;
  endsAt: number;
  talkDuration?: number;
  preview?: boolean;
  onClose?: () => void;
}

export function TurnFlow({
  speakerName,
  topic,
  isYourTurn,
  turnNumber,
  turnCount,
  endsAt,
  talkDuration = PRESENTATION_SECONDS,
  preview = false,
  onClose,
}: TurnFlowProps) {
  const [stage, setStage] = useState<"next" | "presentation" | "timer">("next");
  const [remaining, setRemaining] = useState(talkDuration);

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
              talkDuration,
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
  }, [endsAt, talkDuration]);

  const hurry = remaining <= 5;
  return (
    <>
      <InkCornerLogo />
      {topic && (
        <section className="ink-turn-topic" aria-label="このターンの話題">
          <span className="ink-turn-topic-label">このターンの話題</span>
          <p tabIndex={0}>{topic}</p>
        </section>
      )}
      {stage !== "timer" && (
        <div className="ink-popup-backdrop">
          <section
            className={`ink-popup ink-popup--${isYourTurn ? "blue" : "green"} is-${stage}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby="turn-title"
          >
            {preview && <span className="ink-popup-preview">検証プレビュー</span>}
            {preview && (
              <button
                type="button"
                className="ink-popup-close"
                onClick={onClose}
                aria-label="ポップアップを閉じる"
              >
                ×
              </button>
            )}
            <p className="ink-popup-kicker">
              発表 {turnNumber} / {turnCount}
            </p>
            <h2 id="turn-title">
              {isYourTurn ? (
                "次はあなたのターン！"
              ) : (
                <>
                  次は
                  <span className="popup-name-phrase">
                    <span className="popup-player-name">{speakerName}</span>
                    <span className="popup-name-suffix">さんのターン</span>
                  </span>
                </>
              )}
            </h2>
            <div className="ink-popup-number" aria-hidden={stage === "next"}>
              {remaining}
              <small>秒</small>
            </div>
            <p className="ink-popup-hint" aria-hidden={stage === "next"}>
              {isYourTurn
                ? `${talkDuration}秒で話してみよう！`
                : "ガヤを入れて盛り上げよう！"}
            </p>
          </section>
        </div>
      )}
      {stage === "timer" && isYourTurn && (
        // The speaker only talks, so the remaining time can fill the screen.
        <div
          className={`ink-turn-big-timer${hurry ? " is-hurry" : ""}`}
          role="timer"
          aria-label={`あなたの発表の残り時間 ${remaining}秒`}
        >
          <strong key={hurry ? remaining : "calm"}>{remaining}</strong>
        </div>
      )}
      {stage === "timer" && !isYourTurn && (
        <div
          className={`ink-turn-timer${hurry ? " is-hurry" : ""}`}
          role="timer"
          aria-label={`発表の残り時間 ${remaining}秒`}
        >
          <span title={`${speakerName}さんの発表`}>
            <span className="popup-player-name">{speakerName}</span>
            <span className="popup-name-suffix">さんの発表</span>
          </span>
          <strong>
            {remaining}
            <small>秒</small>
          </strong>
        </div>
      )}
      {stage === "timer" && preview && (
        <button
          type="button"
          className="ink-turn-preview-close"
          onClick={onClose}
          aria-label="発表ターンのプレビューを閉じる"
        >
          ×
        </button>
      )}
    </>
  );
}
