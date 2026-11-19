import { NEON_COLORS, TALK_DURATION_OPTIONS } from "@gaya/shared";
import type { CSSProperties } from "react";

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
    <div className="team-screen-backdrop">
      <section className="team-screen" role="dialog" aria-modal="true" aria-label="チーム編成">
        <header className="team-screen-heading">
          <span className="team-screen-kicker">MATCH SETUP ／ 02</span>
          <h2>チーム<span>編成</span><em>!</em></h2>
        </header>
        <div className="team-screen-roster">
          {(["A", "B"] as const).map((team) => {
            const color = team === "A" ? colorA : colorB;
            const other = team === "A" ? colorB : colorA;
            const members = players.filter((player) => player.team === team);
            return <section className={`team-card team-card--${team.toLowerCase()}`} key={team} style={{ "--team-ink": color } as CSSProperties} aria-label={`${team}チーム`}>
              <div className="team-card-topline"><span>TEAM {team}</span><span>{String(members.length).padStart(2, "0")} PLAYERS</span></div>
              <h3><span aria-hidden="true">✳</span> チーム {team}</h3>
              <ul className="team-card-members">
                {members.map((player, index) => <li key={player.id}>
                  <span className="team-card-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="team-card-name">{player.displayName}</span>
                  <span className="team-card-mark" aria-hidden="true">✦</span>
                </li>)}
              </ul>
              <div className="team-card-colors">
                <span>INK COLOR <span aria-hidden="true">↗</span></span>
                <div className="team-card-swatches" role="group" aria-label={`${team}チームの色`}>
                  {NEON_COLORS.map(({ name, hex }) => <button key={hex} type="button" title={name} aria-label={`${team}チームを${name}にする`} aria-pressed={color === hex} disabled={!isHost || hex === other} className={color === hex ? "is-selected" : ""} style={{ backgroundColor: hex }} onClick={() => onColorSelect(team, hex)} />)}
                </div>
              </div>
            </section>;
          })}
        </div>
        <div className="team-talk-setting">
          <div className="team-talk-heading"><span className="team-talk-icon" aria-hidden="true">◷</span><div><small>TURN TIME / トーク設定</small><strong>ひとりのトーク時間</strong></div></div>
          <div className="team-talk-options" role="group" aria-label="ひとりのトーク時間">
            {TALK_DURATION_OPTIONS.map((seconds) => <button key={seconds} type="button" aria-label={`${seconds}秒`} aria-pressed={talkDuration === seconds} disabled={!isHost} className={talkDuration === seconds ? "is-selected" : ""} onClick={() => onTalkDurationSelect(seconds)}><strong>{seconds}</strong><span>秒</span></button>)}
          </div>
        </div>
        <footer className="team-screen-footer">
          {!isHost && <p>ルーム作成者がチームを決めています…</p>}
          {isHost && <div className="team-screen-actions">
            <button className="team-screen-back" type="button" onClick={onReturnToLobby}><span aria-hidden="true">↶</span> ロビーに戻る</button>
            <button className="team-screen-reshuffle" type="button" onClick={onReshuffle}><span aria-hidden="true">↻</span> 選び直す</button>
            <button className="team-screen-start" type="button" disabled={!canStart} onClick={onStart}>このチームでスタート <span aria-hidden="true">➜</span></button>
          </div>}
        </footer>
      </section>
    </div>
  );
}
