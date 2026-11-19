import { useState, type ReactNode } from "react";
import { NEON_COLORS, pickRandomTopics } from "@gaya/shared";

/** Top-right ink color swatches for the waiting room. */
export function LobbyColorButtons({
  color,
  onSelect,
}: {
  color: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="lobby-hud-colors" role="group" aria-label="インクの色">
      {NEON_COLORS.map((entry) => (
        <button
          key={entry.hex}
          type="button"
          className="lobby-hud-swatch"
          style={{ background: entry.hex }}
          aria-label={`${entry.name}のインク`}
          aria-pressed={color === entry.hex}
          onClick={() => onSelect(entry.hex)}
        />
      ))}
    </div>
  );
}

interface LobbyActionsProps {
  /** The story field; rendered inside the dialog. */
  episodeInput: ReactNode;
  onSelectTopic: (topic: string) => void;
  episodeDone: boolean;
  microphoneListening: boolean;
  microphoneChanging: boolean;
  onStartMicrophone: () => void;
  isReady: boolean;
  readyCount: number;
  playerCount: number;
  onReady: () => void;
}

/**
 * Bottom-right waiting-room controls: an "episode missing" banner, episode status (opens the
 * input), and ready.
 * Ready stays disabled until an episode is saved; the server enforces the same rule.
 */
export function LobbyActions({
  episodeInput,
  onSelectTopic,
  episodeDone,
  microphoneListening,
  microphoneChanging,
  onStartMicrophone,
  isReady,
  readyCount,
  playerCount,
  onReady,
}: LobbyActionsProps) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<string[]>(() => pickRandomTopics(3));
  return (
    <>
      <div className="lobby-hud-actions">
        {(!episodeDone || !microphoneListening) && (
          <div className="lobby-hud-banner" role="status">
            <strong>準備に必要なこと</strong>
            <ul>
              {!episodeDone && <li>エピソードを入力する</li>}
              {!microphoneListening && <li>マイクをオンにする</li>}
            </ul>
          </div>
        )}
        <button
          type="button"
          className={`lobby-hud-episode${episodeDone ? " is-done" : ""}`}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <span>話すエピソード</span>
          <strong>{episodeDone ? "完了 ✓" : "未完了"}</strong>
        </button>
        <button
          type="button"
          className={`lobby-hud-microphone${microphoneListening ? " is-done" : ""}`}
          disabled={microphoneListening || microphoneChanging}
          onClick={onStartMicrophone}
        >
          <span>{microphoneListening ? "マイク" : "マイクをオンにする"}</span>
          <strong>
            {microphoneListening ? "オン ✓" : microphoneChanging ? "切り替え中" : "オフ"}
          </strong>
        </button>
        <button
          type="button"
          className="lobby-hud-ready"
          aria-pressed={isReady}
          disabled={!isReady && (!episodeDone || !microphoneListening)}
          title={
            !isReady && !microphoneListening
              ? "マイクをオンにしてください"
              : !episodeDone ? "エピソードを書くと準備OKにできます" : undefined
          }
          onClick={onReady}
        >
          {isReady ? "準備OK ✓（取り消す）" : "準備OKにする"}
          <small>
            {readyCount}/{playerCount}人
          </small>
        </button>
      </div>
      {open && (
        <div className="lobby-hud-dialog-backdrop" onClick={() => setOpen(false)}>
          <section
            className="lobby-hud-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="話すエピソード"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lobby-hud-topics">
              <div>
                <span>トークのお題（ヒント）</span>
                <button
                  type="button"
                  aria-label="別の話題を表示"
                  onClick={() => setTopics(pickRandomTopics(3))}
                >
                  ↻
                </button>
              </div>
              <ul>
                {topics.map((topic) => (
                  <li key={topic}>
                    <button type="button" onClick={() => onSelectTopic(topic)}>
                      {topic}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {episodeInput}
            <button
              type="button"
              className="lobby-hud-dialog-close"
              onClick={() => setOpen(false)}
            >
              閉じる
            </button>
          </section>
        </div>
      )}
    </>
  );
}
