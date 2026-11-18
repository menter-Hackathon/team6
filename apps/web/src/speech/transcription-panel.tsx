import { useId, useState } from "react";
import { useTranscription } from "./use-transcription";
import "./transcription.css";

export function TranscriptionPanel() {
  const [open, setOpen] = useState(false);
  const speech = useTranscription();
  const id = useId();
  const close = () => {
    speech.stop();
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
        {speech.listening ? "● マイク入力中" : "音声を文字化"}
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
              <p>端末内で処理 · API課金なし</p>
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
          <p className="speech-note">
            音声は外部に送信しません。初回のみ認識モデルをダウンロードします。
          </p>
          {speech.phase !== "ready" ? (
            <div className="speech-setup">
              <button
                disabled={speech.phase === "loading"}
                onClick={speech.prepare}
              >
                {speech.phase === "loading"
                  ? "認識モデルを準備中…"
                  : "認識モデルを準備"}
              </button>
              {speech.phase === "loading" && (
                <>
                  <progress
                    aria-label="認識モデルの準備状況"
                    max={100}
                    value={speech.progress}
                  />
                  <span>
                    {Math.floor(speech.progress)}% · 初回は時間がかかります
                  </span>
                  <button className="speech-secondary" onClick={speech.cancel}>
                    準備を中止
                  </button>
                </>
              )}
            </div>
          ) : null}
          <>
            <div className="speech-actions">
              {speech.listening || speech.starting ? (
                <button className="speech-stop" onClick={() => speech.stop()}>
                  {speech.starting ? "開始をキャンセル" : "マイクを停止"}
                </button>
              ) : (
                <button
                  onClick={() => void speech.start()}
                  disabled={
                    speech.phase !== "ready" ||
                    speech.decoding ||
                    speech.pending >= 3
                  }
                >
                  マイクで開始
                </button>
              )}
              {speech.phase === "ready" && (
                <label className="speech-file">
                  音声ファイルで試す
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={
                      speech.listening ||
                      speech.starting ||
                      speech.decoding ||
                      speech.pending >= 3
                    }
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void speech.transcribeFile(file);
                    }}
                  />
                </label>
              )}
            </div>
            <div className="speech-state">
              <span className={speech.listening ? "speech-live" : ""} />
              {speech.starting
                ? "マイクの許可を確認中…"
                : speech.listening
                  ? speech.activity.speaking
                    ? "声を検出しています"
                    : "声を待っています"
                  : "マイクは停止中"}
            </div>
            <meter
              aria-label="マイクの音量"
              min={0}
              max={1}
              value={speech.activity.level}
            />
            <p className="speech-note">
              話し終わると文字にします。長い発話は約6秒ごとに区切ります。
            </p>
          </>
          <div className="speech-feedback" role="status" aria-live="polite">
            {speech.decoding
              ? "音声を読み込み中…"
              : speech.pending
                ? `文字起こし中…（${speech.pending}件）`
                : speech.phase === "ready"
                  ? "文字起こしの準備ができています"
                  : speech.listening
                    ? "マイク入力中です（モデル未準備）"
                    : "モデルを準備すると使えます"}
          </div>
          {speech.error && (
            <p className="speech-error" role="alert">
              {speech.error}
            </p>
          )}
          <div className="speech-results-heading">
            <h3>認識した言葉</h3>
            <button
              disabled={!speech.transcripts.length || speech.pending > 0}
              onClick={speech.clear}
            >
              履歴を消す
            </button>
          </div>
          <ol
            className="speech-results"
            aria-label="文字起こし結果"
            aria-live="polite"
            aria-relevant="additions"
          >
            {speech.transcripts.map((item) => (
              <li key={item.id}>
                <p>{item.text}</p>
                <small>
                  {item.source === "file" ? "ファイル" : "マイク"} · 音声{" "}
                  {(item.durationMs / 1000).toFixed(1)}秒 · 認識{" "}
                  {(item.processingMs / 1000).toFixed(1)}秒
                </small>
              </li>
            ))}
          </ol>
          {!speech.transcripts.length && (
            <p className="speech-empty">認識結果がここに表示されます。</p>
          )}
          <p className="speech-footnote">
            分類モデルは未接続です。ゲームの塗りには反映しません。
          </p>
        </section>
      )}
    </>
  );
}
