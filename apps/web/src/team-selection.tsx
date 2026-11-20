import { NEON_COLORS, TALK_DURATION_OPTIONS } from "@gaya/shared";
import type { CSSProperties } from "react";
import { InkBlobButton, InkSplats, LOGO_SRC } from "./ink-screen";

interface TeamSelectionProps {
  players: { id: string; displayName: string; team: string }[];
  colorA: string;
  colorB: string;
  isHost: boolean;
  talkDuration: number;
  onTalkDurationSelect: (seconds: number) => void;
  onColorSelect: (team: "A" | "B", color: string) => void;
  onReshuffle: () => void;
  onReturnToLobby: () => void;
  canStart?: boolean;
  onStart: () => void;
}

/**
 * Team setup ("チーム編成！"). The room creator picks colors, talk time and
 * reshuffles; everyone else sees the same cards read-only with a waiting bar.
 */
export function TeamSelection({
  players,
  colorA,
  colorB,
  isHost,
  talkDuration,
  onTalkDurationSelect,
  onColorSelect,
  onReshuffle,
  onReturnToLobby,
  canStart = true,
  onStart,
}: TeamSelectionProps) {
  return (
    <section
      className={`ink-entry ink-team-screen${isHost ? " is-host" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="チーム編成"
    >
      <InkSplats />
      <img className="ink-corner-logo" src={LOGO_SRC} alt="ガヤペ！" />
      <div className="ink-team-stage">
        <h2 className="ink-team-title">チーム編成！</h2>
        {isHost && (
          <div className="ink-panel-corner ink-team-corner">
            <button type="button" className="ink-panel-link" onClick={onReturnToLobby}>
              ← ロビーにもどる
            </button>
          </div>
        )}

        <div className="ink-team-roster">
          {(["A", "B"] as const).map((team) => {
            const color = team === "A" ? colorA : colorB;
            const other = team === "A" ? colorB : colorA;
            const members = players.filter((player) => player.team === team);
            return (
              <section
                key={team}
                className={`ink-team-card ink-team-card--${team.toLowerCase()}`}
                style={{ "--team-ink": color } as CSSProperties}
                aria-label={`チーム${team}`}
              >
                <h3 className="ink-team-name">
                  チーム {team}
                  <small>{members.length}人</small>
                </h3>
                <ol className="ink-team-members">
                  {members.map((player) => (
                    <li key={player.id}>{player.displayName}</li>
                  ))}
                </ol>
                <div className="ink-team-colors" role="group" aria-label={`チーム${team}の色`}>
                  <span>インクの色</span>
                  <div>
                    {NEON_COLORS.map(({ name, hex }) => (
                      <button
                        key={hex}
                        type="button"
                        title={name}
                        aria-label={`チーム${team}を${name}にする`}
                        aria-pressed={color === hex}
                        disabled={!isHost || hex === other}
                        style={{ backgroundColor: hex }}
                        onClick={() => onColorSelect(team, hex)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="ink-team-bar">
          {isHost ? (
            <>
              <div className="ink-team-talk" role="group" aria-label="ひとりのトーク時間">
                <span>トーク時間</span>
                {TALK_DURATION_OPTIONS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    aria-label={`${seconds}秒`}
                    aria-pressed={talkDuration === seconds}
                    onClick={() => onTalkDurationSelect(seconds)}
                  >
                    {seconds}
                    <small>秒</small>
                  </button>
                ))}
              </div>
              <button type="button" className="ink-team-reshuffle" onClick={onReshuffle}>
                ↻ 選び直す
              </button>
            </>
          ) : (
            <p className="ink-team-waiting" role="status">
              ルーム作成者が調整中
              <span className="ink-team-dots" aria-hidden="true">
                <span>。</span>
                <span>。</span>
                <span>。</span>
              </span>
              <small>トーク時間 {talkDuration}秒</small>
            </p>
          )}
        </div>

        {isHost && (
          <div className="ink-team-start">
            <InkBlobButton
              color="magenta"
              disabled={!canStart}
              title={!canStart ? "全員がそろうとスタートできます" : undefined}
              onClick={onStart}
            >
              スタート！
            </InkBlobButton>
          </div>
        )}
      </div>
    </section>
  );
}
