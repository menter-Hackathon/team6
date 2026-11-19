import { useState } from "react";
import "./ink-theme.css";

type Step = "choose" | "create" | "join";

interface EntryScreenProps {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  turnOrder: string;
  onTurnOrderChange: (order: string) => void;
  devMatch: boolean;
  onDevMatchChange: (devMatch: boolean) => void;
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
  return (
    <section className="ink-entry" aria-label="ルームに入る">
      <div className="ink-entry-splats" aria-hidden="true">
        <span className="ink-splat ink-splat--pink" />
        <span className="ink-splat ink-splat--cyan" />
        <span className="ink-splat ink-splat--yellow" />
      </div>
      <div className="ink-entry-card">
        <p className="ink-entry-kicker">GAYA SPLATOON</p>
        <h2 className="ink-entry-title">
          ガヤで<span>塗れ！</span>
        </h2>

        {step === "choose" && (
          <div className="ink-entry-choices">
            <button
              className="ink-blob-button ink-blob-button--pink"
              onClick={() => setStep("create")}
            >
              <strong>ルームを作る</strong>
            </button>
            <button
              className="ink-blob-button ink-blob-button--cyan"
              onClick={() => setStep("join")}
            >
              <strong>ルームに参加する</strong>
            </button>
          </div>
        )}

        {step === "create" && (
          <form
            className="ink-entry-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (name && !props.connecting) props.onCreate();
            }}
          >
            <h3>ルームを作る</h3>
            <label>
              <span>ユーザーネーム</span>
              <input
                autoFocus
                aria-label="ユーザーネーム"
                maxLength={20}
                placeholder="例：たろう"
                value={props.displayName}
                onChange={(event) =>
                  props.onDisplayNameChange(event.target.value)
                }
              />
            </label>
            <label>
              <span>発表順</span>
              <select
                aria-label="発表順"
                value={props.turnOrder}
                onChange={(event) => props.onTurnOrderChange(event.target.value)}
              >
                <option value="alternating">チーム交互（各チーム内はランダム）</option>
                <option value="random">全員ランダム</option>
              </select>
            </label>
            <label className="ink-entry-check">
              <input
                type="checkbox"
                checked={props.devMatch}
                onChange={(event) => props.onDevMatchChange(event.target.checked)}
              />
              <span>開発者モード（2人から試合を始められる）</span>
            </label>
            <div className="ink-entry-actions">
              <button type="button" className="ink-link" onClick={() => setStep("choose")}>
                ← もどる
              </button>
              <button
                type="submit"
                className="ink-blob-button ink-blob-button--pink ink-blob-button--small"
                disabled={!name || props.connecting}
              >
                {props.connecting ? "作成中…" : "ルームを作成"}
              </button>
            </div>
            <p className="ink-entry-note">
              作成するとルームIDが発行され、待機室でコピーして共有できます。インクの色は待機室で選べます。
            </p>
          </form>
        )}

        {step === "join" && (
          <form
            className="ink-entry-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (name && props.inviteCode.trim() && !props.connecting)
                props.onJoin();
            }}
          >
            <h3>ルームに参加する</h3>
            <label>
              <span>ルームID</span>
              <input
                autoFocus={!props.inviteCode}
                aria-label="ルームID"
                placeholder="例：A1B2C3D4"
                autoCapitalize="characters"
                value={props.inviteCode}
                onChange={(event) => props.onInviteCodeChange(event.target.value)}
              />
            </label>
            <label>
              <span>ユーザーネーム</span>
              <input
                autoFocus={Boolean(props.inviteCode)}
                aria-label="ユーザーネーム"
                maxLength={20}
                placeholder="例：たろう"
                value={props.displayName}
                onChange={(event) =>
                  props.onDisplayNameChange(event.target.value)
                }
              />
            </label>
            <div className="ink-entry-actions">
              <button type="button" className="ink-link" onClick={() => setStep("choose")}>
                ← もどる
              </button>
              <button
                type="submit"
                className="ink-blob-button ink-blob-button--cyan ink-blob-button--small"
                disabled={!name || !props.inviteCode.trim() || props.connecting}
              >
                {props.connecting ? "入室中…" : "入室する"}
              </button>
            </div>
          </form>
        )}

        {props.errorMessage && (
          <p className="ink-entry-error" role="alert">
            {props.errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}
