import { useRef, useState } from "react";
import { REACTION_KEYS, type ReactionSegment } from "@gaya/shared";
import type {
  useReactionClassification,
  ReactionJudgment,
} from "./use-reaction-classification";

export function ReactionClassificationPanel({
  judge,
}: {
  judge: ReturnType<typeof useReactionClassification>;
}) {
  const [text, setText] = useState("");
  const [streamTestText, setStreamTestText] = useState("");
  const streamTestId = useRef(crypto.randomUUID());
  return (
    <section className="reaction-classification" aria-label="発話の判定と塗り">
      <h3>判定 → 塗り</h3>
      <p className="speech-note">
        1 長い文章 · 2 短い相槌 · 3 迷い · 除外は発射なし
      </p>
      <div role="status" className="speech-feedback">
        {judge.phase === "loading"
          ? "判定モデルを準備中…（初回は約1.1GBを取得）"
          : judge.pending
            ? `判定中… ${judge.pending}件`
            : judge.phase === "ready"
              ? "判定の準備OK · 相槌は途中認識から塗ります"
              : "判定モデルを準備してください。音声の確定時にも自動で準備します。"}
      </div>
      {judge.phase !== "ready" && (
        <button
          className="speech-secondary"
          disabled={judge.phase === "loading"}
          onClick={() => void judge.prepare()}
        >
          判定モデルを準備
        </button>
      )}
      {judge.error && (
        <p role="alert" className="speech-error">
          {judge.error}
        </p>
      )}
      {judge.previewParts.length > 0 && (
        <div
          className="reaction-last-result"
          role="status"
          aria-label="認識中に発射した相槌"
        >
          <strong>認識中に発射済み · {judge.previewParts.length}回</strong>
          <p>{judge.previewParts.map((part) => part.text).join(" / ")}</p>
          <ClassificationSegments segments={judge.previewParts} />
        </div>
      )}
      {judge.results.length > 0 && (
        <ol
          className="reaction-judgment-history"
          aria-label="文章ごとの分類結果"
          aria-live="polite"
        >
          {judge.results.map((result) => (
            <li key={result.id} className="reaction-last-result">
              <ClassificationBadge
                judgment={{
                  state: "done",
                  level: result.level,
                  segments: result.segments,
                }}
              />
              <p>{result.text}</p>
              <ClassificationSegments segments={result.segments} />
              <small>確定後の判定待ち {Math.round(result.elapsedMs)}ms</small>
            </li>
          ))}
        </ol>
      )}
      <details className="speech-options">
        <summary>元の話・ユーザーネーム・文字で試す</summary>
        <label className="speech-model">
          元の話（任意）
          <textarea
            aria-label="元の話（任意）"
            maxLength={2000}
            rows={2}
            value={judge.source}
            onChange={(event) => judge.changeSource(event.target.value)}
          />
        </label>
        <label className="speech-model">
          相槌にするユーザーネーム（追加）
          <textarea
            aria-label="相槌にするユーザーネーム（追加）"
            maxLength={650}
            rows={2}
            value={judge.additionalUserNames}
            onChange={(event) =>
              judge.changeAdditionalUserNames(event.target.value)
            }
            placeholder="例：たろう、花子（改行やカンマで区切る）"
          />
        </label>
        <p className="speech-note">
          参加者のユーザーネームは自動で使います。名前を含む発言は、長さやモデルの結果にかかわらず「2：短い相槌」にします。
          {judge.registeredUserNames.filter(Boolean).length > 0 &&
            ` 参加者名：${judge.registeredUserNames.filter(Boolean).join("、")}`}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) judge.submit(text);
          }}
        >
          <label className="speech-model">
            判定する文章
            <input
              aria-label="判定する文章"
              maxLength={500}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="例：なるほど"
            />
          </label>
          <button disabled={!text.trim() || judge.pending >= 8}>
            文字で判定して塗る
          </button>
        </form>
        <label className="speech-model">
          相槌の途中入力を試す（入力ごとに塗り）
          <input
            aria-label="相槌の途中入力を試す"
            value={streamTestText}
            maxLength={500}
            placeholder="はい → はいはい と順に入力"
            onChange={(event) => {
              const next = event.target.value;
              if (!next) {
                judge.submit(streamTestText, streamTestId.current);
                streamTestId.current = crypto.randomUUID();
              }
              setStreamTestText(next);
              if (next.trim()) judge.preview(next, streamTestId.current);
            }}
          />
        </label>
        <button
          className="speech-secondary"
          disabled={!streamTestText.trim()}
          onClick={() => {
            judge.submit(streamTestText, streamTestId.current);
            setStreamTestText("");
            streamTestId.current = crypto.randomUUID();
          }}
        >
          途中入力を確定（二重発射しません）
        </button>
      </details>
      <p className="speech-note">
        途中・確定した文字、元の話、ユーザーネームをゲームの判定サーバーへ送ります。短い相槌は最初の1個が認識された時点から塗ります。途中認識が後で修正されても、発射済みの塗りは残ります。判定はNode上で実行し、音声や文章のファイル・ログは保存しません（判定中のメモリ・キャッシュは使用します）。キー1〜4でも演出を確認できます。
      </p>
    </section>
  );
}

export function ClassificationBadge({
  judgment,
}: {
  judgment: ReactionJudgment | undefined;
}) {
  const label =
    judgment?.state === "done"
      ? (judgment.segments?.length ?? 0) > 1
        ? `${judgment.segments!.length}件に分けて判定`
        : judgment.level === "除外"
          ? "除外：インクなし"
          : `${REACTION_KEYS[judgment.level]}：${judgment.level}`
      : judgment?.state === "queued"
        ? "判定待ち"
        : judgment?.state === "classifying"
          ? "判定中…"
          : judgment?.state === "failed"
            ? "判定失敗：塗りなし"
            : judgment?.state === "cancelled"
              ? "判定中止：塗りなし"
              : "未判定";
  return (
    <strong
      className="speech-classification-badge"
      data-state={judgment?.state ?? "idle"}
      data-excluded={judgment?.state === "done" && judgment.level === "除外"}
    >
      {label}
    </strong>
  );
}

export function ClassificationSegments({
  segments,
}: {
  segments: ReactionSegment[] | undefined;
}) {
  if (!segments || segments.length < 2) return null;
  return (
    <ol className="speech-segment-results" aria-label="相槌ごとの判定">
      {segments.map((segment, index) => (
        <li key={index}>
          <ClassificationBadge
            judgment={{ state: "done", level: segment.level }}
          />
          <span>{segment.text}</span>
        </li>
      ))}
    </ol>
  );
}
