import { useState } from "react";
import "./ink-theme.css";

type Step = "choose" | "create" | "join";

/**
 * Title logo image. Until the logo asset is committed this stays null and a
 * placeholder frame is shown in its place. To swap it in, import the image
 * (e.g. `import logoUrl from "./assets/gayape-logo.png";`) and set
 * `LOGO_SRC = logoUrl`.
 */
const LOGO_SRC: string | null = null;

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
      <EntrySplats />
      <div className="ink-entry-content">
        <h1
          className={`ink-entry-logo${step === "choose" ? "" : " is-compact"}`}
        >
          {LOGO_SRC ? (
            <img src={LOGO_SRC} alt="ガヤペ！" />
          ) : (
            <span className="ink-entry-logo-placeholder">ガヤペ！（ロゴ）</span>
          )}
        </h1>

        {step === "choose" && (
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
        )}

        {step === "create" && (
          <form
            className="ink-entry-card ink-entry-form"
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
                className="ink-entry-button ink-entry-button--green ink-entry-button--small"
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
            className="ink-entry-card ink-entry-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (name && props.inviteCode.trim() && !props.connecting)
                props.onJoin();
            }}
          >
            <h3>ルームに入室する</h3>
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
                className="ink-entry-button ink-entry-button--blue ink-entry-button--small"
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

/** Background ink: one big splat anchored to each corner plus a few droplets. */
function EntrySplats() {
  return (
    <div className="ink-entry-splats" aria-hidden="true">
      <svg className="ink-entry-splat ink-entry-splat--tl" viewBox="0 0 400 400">
        <path d="M0 0H330C352 28 304 62 252 70C192 82 200 140 230 180C262 226 210 280 152 270C100 262 92 320 52 340C26 352 0 346 0 330Z" />
        <path d="M332 108C362 88 402 110 396 160C390 222 370 300 340 310C310 318 300 280 310 230C318 190 300 130 332 108Z" />
      </svg>
      <svg className="ink-entry-splat ink-entry-splat--tr" viewBox="0 0 500 400">
        <path d="M40 0H500V230C474 246 436 226 404 196C366 160 304 172 262 146C222 122 254 92 200 76C140 58 62 70 40 40C30 25 28 0 40 0Z" />
      </svg>
      <svg className="ink-entry-splat ink-entry-splat--bl" viewBox="0 0 400 400">
        <path d="M0 138C42 118 90 150 112 120C142 80 222 70 262 110C302 150 282 222 300 272C318 330 340 400 340 400H0Z" />
      </svg>
      <svg className="ink-entry-splat ink-entry-splat--br" viewBox="0 0 400 400">
        <path d="M0 400C20 340 60 320 92 290C132 252 140 180 170 140C200 100 232 112 252 160C272 210 292 230 340 240C370 246 400 250 400 250V400Z" />
      </svg>
      <span className="ink-entry-drop ink-entry-drop--magenta ink-entry-drop--a" />
      <span className="ink-entry-drop ink-entry-drop--magenta ink-entry-drop--b" />
      <span className="ink-entry-drop ink-entry-drop--magenta ink-entry-drop--c" />
      <span className="ink-entry-drop ink-entry-drop--green ink-entry-drop--d" />
      <span className="ink-entry-drop ink-entry-drop--green ink-entry-drop--e" />
      <span className="ink-entry-drop ink-entry-drop--green ink-entry-drop--f" />
      <span className="ink-entry-drop ink-entry-drop--blue ink-entry-drop--g" />
    </div>
  );
}
