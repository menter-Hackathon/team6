import { useEffect, useState } from "react";
import {
  GAME_START_COUNTDOWN_SECONDS,
  TOPIC_THINKING_SECONDS,
  pickRandomTopics,
} from "@gaya/shared";
import { PracticeColorPicker } from "./practice-color-picker";

export type PopupScene = "lobby" | "countdown" | "turn" | "result";

interface ProgressionPopupProps {
  scene: PopupScene;
  preview?: boolean;
  roomCode?: string;
  players?: { displayName: string; ready: boolean }[];
  isHost?: boolean;
  isReady?: boolean;
  canStart?: boolean;
  thinkingEndsAt?: number;
  practiceColor?: string;
  onPracticeColorSelect?: (color: string) => void;
  speakerName?: string;
  turnNumber?: number;
  turnCount?: number;
  onReady?: () => void;
  onStart?: () => void;
  onClose?: () => void;
}

function formatThinkingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ProgressionPopup({
  scene,
  preview = false,
  roomCode = "ABCD12",
  players = [],
  isHost = false,
  isReady = false,
  canStart = false,
  thinkingEndsAt,
  practiceColor = "#ff4f8b",
  onPracticeColorSelect,
  speakerName = "プレイヤー",
  turnNumber = 1,
  turnCount = 4,
  onReady,
  onStart,
  onClose,
}: ProgressionPopupProps) {
  const [secondsLeft, setSecondsLeft] = useState(GAME_START_COUNTDOWN_SECONDS);
  const [countdownRun, setCountdownRun] = useState(0);
  const [thinkingLeft, setThinkingLeft] = useState(TOPIC_THINKING_SECONDS);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>(() =>
    pickRandomTopics(3),
  );
  const [copied, setCopied] = useState(false);
  const [linkCopyMessage, setLinkCopyMessage] = useState("");

  useEffect(() => {
    if (scene !== "countdown") return;
    setSecondsLeft(GAME_START_COUNTDOWN_SECONDS);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setSecondsLeft(
        Math.max(
          0,
          GAME_START_COUNTDOWN_SECONDS -
            Math.floor((Date.now() - startedAt) / 1000),
        ),
      );
    }, 50);
    return () => window.clearInterval(timer);
  }, [scene, countdownRun]);

  useEffect(() => {
    if (scene !== "lobby") return;
    const targetEndsAt =
      thinkingEndsAt ?? Date.now() + TOPIC_THINKING_SECONDS * 1000;
    const updateRemaining = () => {
      setThinkingLeft(
        Math.max(
          0,
          Math.min(
            TOPIC_THINKING_SECONDS,
            Math.ceil((targetEndsAt - Date.now()) / 1000),
          ),
        ),
      );
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [scene, thinkingEndsAt]);

  useEffect(() => {
    if (scene !== "lobby") return;
    const rotateTimer = window.setInterval(() => {
      setTopicSuggestions((prev) => pickRandomTopics(3, prev));
    }, 6000);
    return () => window.clearInterval(rotateTimer);
  }, [scene]);

  useEffect(() => {
    if (!preview || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview, onClose]);

  const shuffleSuggestions = () => {
    setTopicSuggestions((prev) => pickRandomTopics(3, prev));
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const copyInviteLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("dev");
    url.searchParams.set("room", roomCode);
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopyMessage("参加リンクをコピーしました");
    } catch {
      setLinkCopyMessage(
        "コピーできませんでした。招待コードを共有してください。",
      );
    }
  };
  const readyCount = players.filter((player) => player.ready).length;

  return (
    <div className="progression-backdrop">
      <section
        className={`progression-popup${scene === "lobby" ? " progression-popup--lobby" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="progression-title"
      >
        {preview && <span className="progression-preview">検証プレビュー</span>}
        {onClose && (
          <button
            className="progression-close"
            onClick={onClose}
            aria-label="ポップアップを閉じる"
          >
            ×
          </button>
        )}
        {scene === "lobby" && (
          <>
            <p className="progression-kicker">THINKING TIME / 1 MINUTE</p>
            <h2 id="progression-title">話す話題を考えよう！</h2>
            <p className="lobby-thinking-lead">
              自分のターン（30秒）で話すエピソードを1つ決めよう。考え終わったら「準備OK」を押してね！
            </p>
            <div
              className={`lobby-thinking-timer${canStart ? " lobby-thinking-timer--ready" : ""}`}
              role="timer"
              aria-label={`話題を考える目安時間 残り${thinkingLeft}秒`}
            >
              <div>
                <span className="lobby-thinking-timer-label">
                  シンキングタイム
                </span>
                <strong className="lobby-thinking-timer-value">
                  {thinkingLeft > 0
                    ? formatThinkingTime(thinkingLeft)
                    : "時間終了！"}
                </strong>
              </div>
              <p className="lobby-thinking-timer-note">
                {canStart
                  ? "全員の準備が完了しました！1分待たずにすぐ始められます"
                  : thinkingLeft > 0
                    ? "全員が準備OKになれば1分待たずにスキップして始められます"
                    : "話題が決まったら準備OKを押してゲームを始めよう！"}
              </p>
            </div>
            <div className="lobby-topic-box" aria-label="話題のヒント">
              <div className="lobby-topic-box-header">
                <span>話題に迷ったら（ランダム例）</span>
                <button
                  type="button"
                  className="lobby-topic-shuffle"
                  onClick={shuffleSuggestions}
                >
                  ほかの話題を見る
                </button>
              </div>
              <ul className="lobby-topic-list">
                {topicSuggestions.map((topic) => (
                  <li key={topic}>「{topic}」</li>
                ))}
              </ul>
            </div>
            <PracticeColorPicker
              color={practiceColor}
              onSelect={onPracticeColorSelect}
            />
            <div className="progression-code">
              <div>
                <span>招待コード</span>
                <strong>{roomCode}</strong>
              </div>
              <button
                onClick={() => void copyCode()}
                aria-label="招待コードをコピー"
              >
                {copied ? "コピー済み ✓" : "コピー"}
              </button>
            </div>
            {!preview && (
              <>
                <button
                  className="invite-link-button"
                  onClick={() => void copyInviteLink()}
                >
                  参加リンクをコピー
                </button>
                {linkCopyMessage && <p role="status">{linkCopyMessage}</p>}
              </>
            )}
            <p className="lobby-ready-count">
              準備完了（話題決定）{" "}
              <strong>
                {readyCount} / {players.length}
              </strong>
            </p>
            <ul className="lobby-names" aria-label="参加中のプレイヤー">
              {players.map((player, index) => (
                <li key={index}>
                  {player.displayName} {player.ready ? "✓" : ""}
                </li>
              ))}
            </ul>
            <div className="progression-actions">
              <button onClick={onReady}>
                {isReady ? "準備を取り消す" : "話題が決まった！（準備OK）"}
              </button>
              {isHost && (
                <button
                  className="progression-primary"
                  disabled={!canStart}
                  title={
                    !canStart
                      ? "4・6・8人で全員が準備すると開始できます"
                      : undefined
                  }
                  onClick={onStart}
                >
                  チーム決めへ
                </button>
              )}
            </div>
          </>
        )}
        {scene === "countdown" && (
          <>
            <p className="progression-kicker">GAME START</p>
            <h2 id="progression-title">まもなく試合開始！</h2>
            <div className="progression-countdown" aria-live="off">
              <span
                key={`${countdownRun}-${secondsLeft}`}
                className="progression-countdown-number"
              >
                {secondsLeft === 0 ? "GO!" : secondsLeft}
              </span>
            </div>
            <p>発表者の話にガヤを入れて、チームの色でフィールドを塗ろう。</p>
            {preview && (
              <button
                className="progression-replay"
                onClick={() => setCountdownRun((run) => run + 1)}
              >
                もう一度見る
              </button>
            )}
          </>
        )}
        {scene === "turn" && (
          <>
            <p className="progression-kicker">
              PRESENTATION / {turnNumber} OF {turnCount}
            </p>
            <h2 id="progression-title">{speakerName}さんの発表</h2>
            <div className="progression-symbol">
              30<span>秒</span>
            </div>
            <p>発表者は話そう！ ほかのみんなはガヤで盛り上げよう。</p>
          </>
        )}
      </section>
    </div>
  );
}
