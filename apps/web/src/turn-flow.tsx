import { useEffect, useState } from "react";
import { PRESENTATION_SECONDS, TURN_INTRO_MS } from "@gaya/shared";

interface TurnFlowProps {
  speakerName: string;
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

  return (
    <>
      {stage !== "timer" && (
        <div className="progression-backdrop progression-turn-backdrop">
          <section
            className={`progression-popup progression-turn-popup progression-turn-popup--${stage}`}
            role="dialog"
            aria-modal="false"
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
              {isYourTurn ? "次はあなたのターン" : <>
                <span className="popup-title-lead">次は</span>
                <span className="popup-name-phrase"><span className="popup-player-name">{speakerName}</span><span className="popup-name-suffix">さんのターン</span></span>
              </>}
            </h2>
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
                ? `${talkDuration}秒で話してみよう！`
                : "ガヤを入れて盛り上げよう！"}
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
          <span title={isYourTurn ? "あなたの発表" : `${speakerName}さんの発表`}>
            {isYourTurn ? "あなたの発表" : <><span className="popup-player-name">{speakerName}</span><span className="popup-name-suffix">さんの発表</span></>}
          </span>
          <strong>
            {remaining}
            <small>秒</small>
          </strong>
          {preview && (
            <button
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
