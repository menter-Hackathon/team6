import { useState } from "react";
import { ArrowCircleIcon, CopyIcon, InkBlobButton, InkPanelScreen } from "./ink-screen";

interface WaitingRoomProps {
  roomCode: string;
  players: { displayName: string; ready: boolean }[];
  /** Seats in this room (for "2/4人"). */
  seatCount: number;
  requiredPlayerCount: number;
  episodeDone: boolean;
  microphoneListening: boolean;
  microphoneChanging: boolean;
  isReady: boolean;
  isHost: boolean;
  canStart: boolean;
  startHint: string;
  onOpenEpisode: () => void;
  onOpenWardrobe: () => void;
  onStartMicrophone: () => void;
  onReady: () => void;
  onStart?: (() => void) | undefined;
  /** Hides this screen to walk around the practice field. */
  onClose: () => void;
}

/** Full-screen waiting room ("入室待ち") shown right after creating or joining a room. */
export function WaitingRoom({
  roomCode,
  players,
  seatCount,
  requiredPlayerCount,
  episodeDone,
  microphoneListening,
  microphoneChanging,
  isReady,
  isHost,
  canStart,
  startHint,
  onOpenEpisode,
  onOpenWardrobe,
  onStartMicrophone,
  onReady,
  onStart,
  onClose,
}: WaitingRoomProps) {
  const [copyMessage, setCopyMessage] = useState("");
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(done);
    } catch {
      setCopyMessage("コピーできませんでした。招待コードを共有してください。");
    }
  };
  const inviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("dev");
    url.searchParams.set("room", roomCode);
    return url.toString();
  };
  const readyCount = players.filter((player) => player.ready).length;
  const readyBlocked = !isReady && (!episodeDone || !microphoneListening);
  const missing = [!episodeDone && "エピソードを決める", !microphoneListening && "マイクをオンにする"].filter(Boolean);
  const readyHint = readyBlocked ? `まだ：${missing.join("・")}` : undefined;

  return (
    <InkPanelScreen
      label="入室待ち"
      title="入室待ち"
      color="green"
      blockedHint={readyHint}
      corner={
        <button type="button" className="ink-panel-link" onClick={onClose}>
          フィールドで練習 ×
        </button>
      }
      blob={
        <InkBlobButton
          color="blue"
          aria-pressed={isReady}
          onClick={onReady}
        >
          {isReady ? "準備OK ✓" : "準備OK！"}
          <small>
            {readyCount}/{seatCount}人
          </small>
        </InkBlobButton>
      }
    >
      <div className="ink-panel-box ink-waiting-code">
        <span className="ink-panel-box-label">招待コード</span>
        <strong>{roomCode}</strong>
        <button
          type="button"
          className="ink-icon-button"
          aria-label="招待コードをコピー"
          onClick={() => void copy(roomCode, "招待コードをコピーしました")}
        >
          <CopyIcon />
        </button>
      </div>
      <div className="ink-waiting-links">
        <button
          type="button"
          className="ink-panel-link ink-panel-link--plain"
          onClick={() => void copy(inviteLink(), "参加リンクをコピーしました")}
        >
          参加リンクをコピー
        </button>
        {copyMessage && <span role="status">{copyMessage}</span>}
      </div>

      <div className="ink-waiting-steps">
        <button
          type="button"
          className={`ink-panel-box ink-waiting-step${episodeDone ? " is-done" : " is-missing"}`}
          aria-haspopup="dialog"
          onClick={onOpenEpisode}
        >
          <span>
            エピソード
            <br />
            {episodeDone ? "決定済み ✓" : "決定へ"}
          </span>
          <ArrowCircleIcon />
        </button>
        <button
          type="button"
          className="ink-panel-box ink-waiting-step"
          aria-haspopup="dialog"
          onClick={onOpenWardrobe}
        >
          <span>
            スキン
            <br />
            決定へ
          </span>
          <ArrowCircleIcon />
        </button>
      </div>

      <div className="ink-panel-box ink-waiting-players">
        <span className="ink-panel-box-label">参加者</span>
        <ul aria-label="参加中のプレイヤー">
          {players.map((player, index) => (
            <li key={index} className={player.ready ? "is-ready" : undefined}>
              {player.displayName}
              {player.ready && <span aria-label="準備OK"> ✓</span>}
            </li>
          ))}
        </ul>
      </div>

      {!microphoneListening && (
        <button
          type="button"
          className="ink-panel-link ink-waiting-mic is-missing"
          disabled={microphoneChanging}
          onClick={onStartMicrophone}
        >
          {microphoneChanging ? "マイクを切り替え中…" : "🎤 マイクをオンにする（準備OKに必要）"}
        </button>
      )}
      {requiredPlayerCount > players.length && (
        <p className="ink-waiting-note" role="status">
          再戦にはあと{requiredPlayerCount - players.length}人の入室が必要です
        </p>
      )}
      {isHost && onStart && (
        <button
          type="button"
          className="ink-entry-button ink-entry-button--blue ink-entry-button--small ink-waiting-start"
          disabled={!canStart}
          title={!canStart ? startHint : undefined}
          onClick={onStart}
        >
          チーム決めへ
        </button>
      )}
    </InkPanelScreen>
  );
}
