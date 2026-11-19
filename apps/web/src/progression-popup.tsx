import { WardrobeButton } from "./wardrobe";
import { useEffect, useState } from "react";
import { GAME_START_COUNTDOWN_SECONDS } from "@gaya/shared";


export type PopupScene = "lobby" | "countdown" | "turn" | "result";

interface ProgressionPopupProps {
  scene: PopupScene;
  preview?: boolean;
  roomCode?: string;
  players?: { displayName: string; ready: boolean }[];
  isHost?: boolean;
  isReady?: boolean;
  canStart?: boolean;
  requiredPlayerCount?: number;

  onOpenWardrobe?: () => void;

  speakerName?: string;
  turnNumber?: number;
  turnCount?: number;
  countdownEndsAt?: number;
  onReady?: () => void;
  onStart?: () => void;
  onClose?: () => void;
}

export function ProgressionPopup({
  scene,
  preview = false,
  roomCode = "ABCD12",
  players = [],
  isHost = false,
  isReady = false,
  canStart = false,
  requiredPlayerCount = 0,

  onOpenWardrobe,

  speakerName = "プレイヤー",
  turnNumber = 1,
  turnCount = 4,
  countdownEndsAt,
  onReady,
  onStart,
  onClose,
}: ProgressionPopupProps) {
  const [secondsLeft, setSecondsLeft] = useState(GAME_START_COUNTDOWN_SECONDS);
  const [countdownRun, setCountdownRun] = useState(0);
  const [copied, setCopied] = useState(false);
  const [linkCopyMessage, setLinkCopyMessage] = useState("");

  useEffect(() => {
    if (scene !== "countdown") return;
    setSecondsLeft(GAME_START_COUNTDOWN_SECONDS);
    const endsAt = countdownEndsAt ?? Date.now() + GAME_START_COUNTDOWN_SECONDS * 1000;
    const timer = window.setInterval(() => {
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil((endsAt - Date.now()) / 1000),
        ),
      );
    }, 50);
    return () => window.clearInterval(timer);
  }, [scene, countdownRun, countdownEndsAt]);

  useEffect(() => {
    if (!preview || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview, onClose]);

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
    <div className={`progression-backdrop progression-backdrop--${scene}`}>
      <section
        className={`progression-popup${scene === "lobby" ? " progression-popup--lobby" : ""}`}
        role="dialog"
        aria-modal="false"
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
            <span className="lobby-kicker">MATCH LOBBY ／ 01</span>
            <h2 id="progression-title">入室待ち</h2>
            <div className="progression-code">
              <div>
                <span>INVITE CODE / 招待コード</span>
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
              <button className="invite-link-button" onClick={() => void copyInviteLink()}>
                参加リンクをコピー <span aria-hidden="true">↗</span>
              </button>
            )}
            {linkCopyMessage && <p className="lobby-copy-status" role="status">{linkCopyMessage}</p>}
            <div className="lobby-readiness">
              <p className="lobby-ready-count">準備完了 <strong>{readyCount} / {Math.max(requiredPlayerCount, players.length)}</strong></p>
            {requiredPlayerCount > players.length && (
              <p className="lobby-replay-waiting" role="status">
                再戦にはあと{requiredPlayerCount - players.length}人の入室が必要です
              </p>
            )}
            <ul className="lobby-names" aria-label="参加中のプレイヤー">
              {players.map((player, index) => (
                <li key={index}>{player.displayName}</li>
              ))}
            </ul>
            </div>
            {!preview && isHost && onStart && (
              <button
                className="progression-primary lobby-start-button"
                disabled={!canStart}
                title={
                  !canStart
                    ? requiredPlayerCount > 0
                      ? `${requiredPlayerCount}人全員が揃って準備完了すると開始できます`
                      : "4・6・8人で全員が準備すると開始できます"
                    : undefined
                }
                onClick={onStart}
              >
                チーム決めへ
              </button>
            )}
            {preview && (
            <div className="progression-actions">
              <button
                className="lobby-ready-button"
                aria-pressed={isReady}
                onClick={onReady}
              >
                {isReady ? "準備を取り消す ✓" : "準備OKにする"}
              </button>
              {isHost && (
                <button
                  className="progression-primary"
                  disabled={!canStart}
                  title={
                    !canStart
                      ? requiredPlayerCount > 0
                        ? `${requiredPlayerCount}人全員が揃って準備完了すると開始できます`
                        : "4・6・8人で全員が準備すると開始できます"
                      : undefined
                  }
                  onClick={onStart}
                >
                  チーム決めへ
                </button>
              )}
            </div>
            )}
            {onOpenWardrobe && <WardrobeButton onClick={onOpenWardrobe} />}
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
            <h2 id="progression-title"><span className="popup-name-phrase"><span className="popup-player-name">{speakerName}</span><span className="popup-name-suffix">さんの発表</span></span></h2>
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
