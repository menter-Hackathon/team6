import { ROOM_PLAYER_COUNTS, type RoomPlayerCount } from "@gaya/shared";
import { useState } from "react";
import { InkBlobButton, InkPanelScreen, InkSplats, LOGO_SRC } from "./ink-screen";

type Step = "choose" | "create" | "join";

interface EntryScreenProps {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  playerCount: RoomPlayerCount;
  onPlayerCountChange: (count: RoomPlayerCount) => void;
  inviteCode: string;
  onInviteCodeChange: (code: string) => void;
  /** Opened from an invite link: start on the join form with the code filled in. */
  fromInviteLink: boolean;
  connecting: boolean;
  errorMessage: string;
  onCreate: () => void;
  onJoin: () => void;
}

/** First screen: pick "create" or "join", then fill in only what that path needs. */
export function EntryScreen(props: EntryScreenProps) {
  const [step, setStep] = useState<Step>(
    props.fromInviteLink && props.inviteCode ? "join" : "choose",
  );
  const name = props.displayName.trim();
  const error = props.errorMessage && (
    <p className="ink-entry-error" role="alert">
      {props.errorMessage}
    </p>
  );
  const back = (
    <button type="button" className="ink-panel-link" onClick={() => setStep("choose")}>
      ← もどる
    </button>
  );
  const code = props.inviteCode.trim();
  const nameInput = (autoFocus: boolean) => (
    <input
      className={`ink-panel-input${name ? "" : " is-missing"}`}
      autoFocus={autoFocus}
      aria-label="ユーザーネーム"
      maxLength={20}
      placeholder="ユーザーネーム"
      value={props.displayName}
      onChange={(event) => props.onDisplayNameChange(event.target.value)}
    />
  );

  if (step === "create") {
    const canCreate = Boolean(name) && !props.connecting;
    const createHint = props.connecting || name ? undefined : "ユーザーネームを入力してね";
    return (
      <InkPanelScreen
        label="ルームを作成"
        title="ルームを作成"
        color="blue"
        corner={back}
        blockedHint={createHint}
        onSubmit={() => {
          if (canCreate) props.onCreate();
        }}
        blob={
          <InkBlobButton
            type="submit"
            color="magenta"
            disabled={props.connecting}
            aria-label="ルームを作成"
          >
            {props.connecting ? "作成中…" : "準備OK！"}
          </InkBlobButton>
        }
      >
        {nameInput(true)}
        <fieldset className="ink-count-picker">
          <legend>プレイ人数</legend>
          <div className="ink-count-options">
            {ROOM_PLAYER_COUNTS.map((count) => (
              <label key={count} className="ink-count-option">
                <input
                  type="radio"
                  name="player-count"
                  value={count}
                  checked={props.playerCount === count}
                  onChange={() => props.onPlayerCountChange(count)}
                />
                <span>{count}人</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error}
      </InkPanelScreen>
    );
  }

  if (step === "join") {
    const canJoin = Boolean(name) && Boolean(code) && !props.connecting;
    const missing = [!name && "ユーザーネーム", !code && "招待コード"].filter(Boolean);
    const joinHint =
      props.connecting || missing.length === 0 ? undefined : `${missing.join("と")}を入力してね`;
    return (
      <InkPanelScreen
        label="ルームに参加"
        title="ルームに参加"
        color="green"
        corner={back}
        blockedHint={joinHint}
        onSubmit={() => {
          if (canJoin) props.onJoin();
        }}
        blob={
          <InkBlobButton type="submit" color="blue" disabled={props.connecting} aria-label="入室する">
            {props.connecting ? "入室中…" : "準備OK！"}
          </InkBlobButton>
        }
      >
        {nameInput(Boolean(props.inviteCode))}
        <input
          className={`ink-panel-input${code ? "" : " is-missing"}`}
          autoFocus={!props.inviteCode}
          aria-label="招待コード"
          placeholder="招待コード"
          autoCapitalize="characters"
          value={props.inviteCode}
          onChange={(event) => props.onInviteCodeChange(event.target.value)}
        />
        {error}
      </InkPanelScreen>
    );
  }

  return (
    <section className="ink-entry" aria-label="ルームに入る">
      <InkSplats />
      <div className="ink-entry-content">
        <h1 className="ink-entry-logo">
          <img src={LOGO_SRC} alt="ガヤペ！" />
        </h1>
        <div className="ink-entry-choices">
          <button
            type="button"
            className="ink-entry-button ink-entry-button--green"
            onClick={() => setStep("create")}
          >
            ルームを作る
          </button>
          <button
            type="button"
            className="ink-entry-button ink-entry-button--blue"
            onClick={() => setStep("join")}
          >
            ルームに入室する
          </button>
        </div>
        {error}
      </div>
    </section>
  );
}
