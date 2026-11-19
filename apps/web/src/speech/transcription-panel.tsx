import { useId, useLayoutEffect, useRef, useState } from "react";
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
  inMatch = false,
}: {
  userNames?: readonly string[];
  /** Joined room; lets the server use the current speaker's story as the source. */
  roomId?: string | undefined;
  inMatch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const judge = useReactionClassification(true, userNames, roomId);
  const local = useTranscription();
  const browser = useBrowserTranscription();
  const [engine, setEngine] = useState("web-speech");
  const external = engine === "web-speech";
  const speech = external ? browser : local;
  const busy = speech.listening || speech.starting || speech.pending > 0;
  const id = useId();
  const panelRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const hud = panel?.parentElement;
    const viewport = hud?.parentElement?.querySelector(".viewport");
    if (!panel || !hud || !viewport) return;

    const gap = 16;
    const minimumPanelHeight = 112;
    let summary: Element | null;
    let guide: Element | null;

    const positionPanel = () => {
      const summaryBounds = summary?.getBoundingClientRect();
      const guideBounds = guide?.getBoundingClientRect();
      const alignment = inMatch ? guideBounds : summaryBounds;
      if (!alignment?.width || !guideBounds?.width) {
        delete panel.dataset.positioned;
        return;
      }

      const top =
        (inMatch ? viewport.getBoundingClientRect().top : alignment.bottom) +
        gap;
      const height = guideBounds.top - gap - top;
      if (height < minimumPanelHeight) {
        delete panel.dataset.positioned;
        return;
      }

      const hudBounds = hud.getBoundingClientRect();
      panel.style.setProperty("--speech-top", `${top - hudBounds.top}px`);
      panel.style.setProperty(
        "--speech-left",
        `${alignment.left - hudBounds.left}px`,
      );
      panel.style.setProperty("--speech-width", `${alignment.width}px`);
      panel.style.setProperty("--speech-height", `${height}px`);
      panel.dataset.positioned = "";
    };

    const resizeObserver = new ResizeObserver(positionPanel);
    const observePanels = () => {
      resizeObserver.disconnect();
      summary = viewport.querySelector(".room-summary");
      guide = viewport.querySelector(".controls");
      resizeObserver.observe(hud);
      resizeObserver.observe(viewport);
      if (summary) resizeObserver.observe(summary);
      if (guide) resizeObserver.observe(guide);
      positionPanel();
    };

    const mutationObserver = new MutationObserver(observePanels);
    mutationObserver.observe(viewport, { childList: true });
    viewport.addEventListener("animationend", positionPanel);
    observePanels();
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      viewport.removeEventListener("animationend", positionPanel);
    };
  }, [open, inMatch]);

  const close = () => setOpen(false);
  const microphoneOn = speech.listening || speech.starting;
  const microphoneStopping = external && browser.stopping;
  const microphoneUnavailable = speech.phase !== "ready" || speech.pending >= 3;
  const toggleMicrophone = () => {
    if (microphoneOn) {
      if (speech.starting && external) browser.cancel();
      else speech.stop();
      return;
    }
    if (judge.phase !== "ready") void judge.prepare();
    void speech.start();
  };

  return (
    <>
      <div className="hud-microphone">
        <button
          type="button"
          className="hud-dev-button speech-microphone"
          aria-label="マイク"
          aria-pressed={microphoneOn}
          title={
            speech.phase !== "ready"
              ? "文字起こしを開いて認識方法を確認してください"
              : undefined
          }
          disabled={
            microphoneStopping || (!microphoneOn && microphoneUnavailable)
          }
          onClick={toggleMicrophone}
        >
          {speech.starting
            ? "マイク起動中"
            : microphoneStopping
              ? "マイク停止中"
              : microphoneOn
                ? "● マイクON"
                : "マイクOFF"}
        </button>
        {!open && speech.error && (
          <small className="hud-microphone-error" role="alert">
            {speech.error}
          </small>
        )}
      </div>
      <button
        type="button"
        className="hud-dev-button speech-toggle"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (open) close();
          else {
            if (document.pointerLockElement) void document.exitPointerLock();
            setOpen(true);
          }
        }}
      >
        文字起こし
      </button>
      {open && (
        <section
          ref={panelRef}
          id={id}
          className={
            inMatch ? "speech-panel speech-panel--match" : "speech-panel"
          }
          aria-label="音声の文字起こし"
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
        >
          <header className="speech-heading">
            <h2>音声の文字起こし</h2>
            <button
              className="speech-close"
              aria-label="文字起こしパネルを閉じる"
              onClick={close}
            >
              ×
            </button>
          </header>
          <p className="speech-note">
            認識途中の文字と確定した文字をゲームの判定サーバーに送ります。ゲームは音声ファイルを保存しません。
          </p>
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
                <p>
                  ブラウザが音声を外部に送る場合があります。Chromeの外部処理先はGoogleです。送信先での保存期間はブラウザのサービスによります。
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
              </div>
              {!browser.supported && (
                <p className="speech-error" role="alert">
                  このブラウザはWeb Speech
                  APIに対応していません。PC版Chromeでこのページを開くか、Whisperへ切り替えてください。
                </p>
              )}
            </>
          ) : (
            <>
              <p className="speech-note">音声は端末内で処理します。</p>
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
                      <span>{Math.floor(local.progress)}%</span>
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
          </>
          {speech.pending > 0 && (
            <div className="speech-feedback" role="status">
              文字起こし中…
            </div>
          )}
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
            <p>{speech.liveText || "—"}</p>
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
                </li>
              );
            })}
          </ol>
          <ReactionClassificationPanel judge={judge} />
        </section>
      )}
    </>
  );
}
