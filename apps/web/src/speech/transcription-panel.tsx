import { useId, useState } from "react";
import type { SpeechModelChoice } from "./protocol";
import { useTranscription } from "./use-transcription";
import { useBrowserTranscription } from "./use-browser-transcription";
import { useReactionClassification } from "./use-reaction-classification";
import {
  ReactionClassificationPanel,
  ClassificationBadge,
  ClassificationSegments,
} from "./reaction-classification-panel";
import "./transcription.css";

export function TranscriptionPanel({
  userNames = [],
  roomId,
}: {
  userNames?: readonly string[];
  /** Joined room; lets the server use the current speaker's story as the source. */
  roomId?: string | undefined;
}) {
  const [open, setOpen] = useState(true);
  const judge = useReactionClassification(open, userNames, roomId);
  const local = useTranscription();
  const browser = useBrowserTranscription();
  const [engine, setEngine] = useState("web-speech");
  const external = engine === "web-speech";
  const speech = external ? browser : local;
  const busy = speech.listening || speech.starting || speech.pending > 0;
  const id = useId();
  const close = () => {
    if (external) browser.cancel();
    else local.stop();
    setOpen(false);
  };
  return (
    <>
      <button
        className="speech-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (open) close();
          else {
            if (document.pointerLockElement) void document.exitPointerLock();
            setOpen(true);
          }
        }}
      >
        {speech.listening ? "● マイクON" : "マイク・文字起こし"}
      </button>
      {open && (
        <section
          id={id}
          className="speech-panel"
          aria-label="音声の文字起こし"
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
        >
          <header className="speech-heading">
            <div>
              <p>
                {external
                  ? "ブラウザの音声認識 · 日本語"
                  : "端末内で処理 · API課金なし"}
              </p>
              <h2>音声の文字起こし</h2>
            </div>
            <button
              className="speech-close"
              aria-label="文字起こしパネルを閉じる"
              onClick={close}
            >
              ×
            </button>
          </header>
          <label className="speech-model">
            認識方法
            <select
              aria-label="認識方法"
              value={engine}
              disabled={busy || local.phase === "loading"}
              onChange={(event) => {
                browser.cancel();
                local.stop(false);
                setEngine(event.target.value);
              }}
            >
              <option value="web-speech">Web Speech API · ブラウザ認識</option>
              <option value="whisper">Whisper · 端末内認識</option>
            </select>
          </label>
          {external ? (
            <>
              <div className="speech-privacy">
                <strong>音声が外部で処理される場合があります</strong>
                <p>
                  Chromeのネットワーク認識では音声をGoogleへ送信します。送信先での保存期間・学習利用の条件は、このAPIでは確認・指定できません。
                </p>
                <p>
                  下の「外部処理でマイクをON」を押すと開始します。このアプリは音声ファイルを保存しません。途中の文字もゲームの判定サーバーで判定し、短い相槌は認識中から塗ります。途中結果が後から変わる場合があります。
                </p>
                <a
                  href="https://policies.google.com/terms?hl=ja"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google利用規約
                </a>
                {" · "}
                <a
                  href="https://policies.google.com/privacy?hl=ja"
                  target="_blank"
                  rel="noreferrer"
                >
                  プライバシーポリシー
                </a>
                <p>
                  処理先・規約はブラウザにより異なります。Google以外のブラウザ認識サービスの条件は未確認です。
                </p>
              </div>
              <p className="speech-note">
                日本語（ja-JP）で認識します。入力はブラウザの既定のマイクを使います。マイクの変更はブラウザのサイト設定で行ってください。
              </p>
              {!browser.supported && (
                <p className="speech-error" role="alert">
                  このブラウザはWeb Speech
                  APIに対応していません。PC版Chromeでこのページを開くか、Whisperへ切り替えてください。
                </p>
              )}
            </>
          ) : (
            <>
              <p className="speech-note">
                音声は端末内で処理します。初回はモデルの準備が必要です。音量バーが声に反応しない場合は入力マイクを確認してください。
              </p>
              <label className="speech-model">
                入力マイク
                <select
                  aria-label="入力マイク"
                  value={local.deviceId}
                  disabled={local.listening || local.starting}
                  onChange={(event) => local.changeDevice(event.target.value)}
                >
                  <option value="">PCの既定のマイク</option>
                  {local.devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `マイク ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <details className="speech-options">
                <summary>
                  認識設定 · {local.model === "fast" ? "速度優先" : "標準"}
                </summary>
                <label className="speech-model">
                  認識モード
                  <select
                    aria-label="認識モード"
                    value={local.model}
                    disabled={
                      local.phase === "loading" ||
                      local.listening ||
                      local.starting ||
                      local.pending > 0
                    }
                    onChange={(event) =>
                      local.changeModel(event.target.value as SpeechModelChoice)
                    }
                  >
                    <option value="fast">速度優先 · Whisper tiny</option>
                    <option value="balanced">標準 · Whisper base</option>
                  </select>
                </label>
                <p className="speech-note">
                  速度優先は聞き間違いが増える場合があります。
                </p>
              </details>
              {local.phase !== "ready" ? (
                <div className="speech-setup">
                  <button
                    disabled={local.phase === "loading"}
                    onClick={local.prepare}
                  >
                    {local.phase === "loading"
                      ? "認識モデルを準備中…"
                      : "認識モデルを準備"}
                  </button>
                  {local.phase === "loading" && (
                    <>
                      <progress
                        aria-label="認識モデルの準備状況"
                        max={100}
                        value={local.progress}
                      />
                      <span>
                        {Math.floor(local.progress)}% · 初回は時間がかかります
                      </span>
                      <button
                        className="speech-secondary"
                        onClick={local.cancel}
                      >
                        準備を中止
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
          <>
            <div className="speech-actions">
              {speech.listening ||
              speech.starting ||
              (external && browser.stopping) ? (
                <button
                  className="speech-stop"
                  disabled={external && browser.stopping}
                  onClick={() => {
                    if (speech.starting && external) browser.cancel();
                    else speech.stop();
                  }}
                >
                  {external && browser.stopping
                    ? "マイク停止・文字を確定中…"
                    : speech.starting
                      ? "開始をキャンセル"
                      : "マイクをOFFにする"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (judge.phase !== "ready") void judge.prepare();
                    void speech.start();
                  }}
                  disabled={speech.phase !== "ready" || speech.pending >= 3}
                >
                  {external ? "外部処理でマイクをON" : "マイクをONにする"}
                </button>
              )}
            </div>
            <div className="speech-state">
              <span className={speech.listening ? "speech-live" : ""} />
              {speech.starting
                ? "マイクの許可を確認中…"
                : speech.listening
                  ? speech.activity.speaking
                    ? "マイクON · 声を検出しています"
                    : "マイクON · 声を待っています"
                  : "マイクOFF · 入力は停止中"}
            </div>
            {!external && (
              <meter
                aria-label="マイクの音量"
                min={0}
                max={1}
                value={local.activity.level}
              />
            )}
            <p className="speech-note">
              話している途中から文字を更新します。途中結果は後で修正される場合があります。このアプリは音声ファイルを作成・保存しません。
            </p>
          </>
          <div className="speech-feedback" role="status" aria-live="polite">
            {external && !browser.supported
              ? "ブラウザ認識を利用できません"
              : speech.pending
                ? "文字起こし中…"
                : speech.phase === "ready"
                  ? "文字起こしの準備ができています"
                  : speech.listening
                    ? "モデルを準備してください"
                    : "認識モデルを準備するとマイクをONにできます"}
          </div>
          {speech.error && (
            <p className="speech-error" role="alert">
              {speech.error}
            </p>
          )}
          <section
            className="speech-live-text"
            aria-label="話している途中の文字"
            aria-live="polite"
            aria-atomic="true"
          >
            <small>認識中 · 途中結果</small>
            <p>
              {speech.liveText ||
                (speech.listening
                  ? "話しかけてください…"
                  : "マイクをONにすると、ここに途中の文字が表示されます。")}
            </p>
          </section>
          <div className="speech-results-heading">
            <h3>文字起こし結果</h3>
            <button
              disabled={
                !speech.transcripts.length ||
                speech.pending > 0 ||
                judge.pending > 0
              }
              onClick={() => {
                speech.clear();
                judge.clearHistory();
              }}
            >
              履歴を消す
            </button>
          </div>
          <ol
            className="speech-results"
            aria-label="文字起こし結果"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {speech.transcripts.map((item) => {
              const judgment = judge.judgments[item.id];
              return (
                <li key={item.id}>
                  <ClassificationBadge judgment={judgment} />
                  <p>{item.text}</p>
                  <ClassificationSegments
                    segments={
                      judgment?.state === "done" ? judgment.segments : undefined
                    }
                  />
                  <small>
                    {item.engine === "web-speech"
                      ? "マイク · Web Speech API · 確定結果"
                      : `マイク · 発話 ${((item.durationMs ?? 0) / 1000).toFixed(1)}秒 · 認識 ${((item.processingMs ?? 0) / 1000).toFixed(1)}秒`}
                  </small>
                </li>
              );
            })}
          </ol>
          {!speech.transcripts.length && (
            <p className="speech-empty">ここに認識した文章が表示されます。</p>
          )}
          <ReactionClassificationPanel judge={judge} />
          <p className="speech-footnote">
            文字起こしと判定・塗りの接続は実験中です。判定が失敗した場合、未発射の部分は塗りません。
          </p>
        </section>
      )}
    </>
  );
}
