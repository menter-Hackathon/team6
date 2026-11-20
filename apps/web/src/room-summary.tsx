import type { ReactNode } from "react";
import { useState } from "react";
import { WardrobeButton } from "./wardrobe";

interface RoomSummaryProps {
  roomCode: string;
  localRoom?: boolean;
  names: string[];
  canStart?: boolean;
  requiredPlayerCount?: number;
  targetPlayerCount?: number;
  onStart?: () => void;
  onClose?: () => void;
  onOpenWardrobe?: () => void;
  ready?: boolean;
  readyCount?: number;
  onReady?: () => void;
  /** The story field (D-090), rendered by the app so its text is shared across views. */
  episodeInput?: ReactNode;
  /** When set, "ready" stays disabled (e.g. the episode is not written yet). */
  readyBlockedReason?: string | undefined;
}

/** Small room card shown on the practice field after closing the waiting room. */
export function RoomSummary({
  roomCode,
  localRoom = false,
  names,
  canStart = false,
  requiredPlayerCount = 0,
  targetPlayerCount = 0,
  onStart,
  onClose,
  onOpenWardrobe,
  ready = false,
  readyCount = 0,
  onReady,
  episodeInput,
  readyBlockedReason,
}: RoomSummaryProps) {
  const [linkCopyMessage, setLinkCopyMessage] = useState("");
  const copyInviteLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("dev");
    url.searchParams.set("room", roomCode);
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopyMessage("参加リンクをコピーしました");
    } catch {
      setLinkCopyMessage(
        "コピーできませんでした。招待コードを共有してください。",
      );
    }
  };
  return (
    <div className="room-summary ink-summary" aria-label="ルーム情報">
      {onClose && (
        <button
          type="button"
          className="ink-summary-close"
          onClick={onClose}
          aria-label="検証プレビューを閉じる"
        >
          ×
        </button>
      )}
      <div className="ink-summary-code">
        <span>{localRoom ? "待機室" : "招待コード"}</span>
        <strong>{localRoom ? "検証ルーム" : roomCode}</strong>
      </div>
      {!onClose && !localRoom && (
        <>
          <button
            type="button"
            className="ink-summary-link"
            onClick={() => void copyInviteLink()}
          >
            参加リンクをコピー
          </button>
          {linkCopyMessage && (
            <p className="ink-summary-status" role="status">
              {linkCopyMessage}
            </p>
          )}
        </>
      )}
      <div className="ink-summary-players">
        <span>参加者</span>
        <ul aria-label="入室中のメンター">
          {names.map((name, index) => (
            <li key={index}>{name}</li>
          ))}
        </ul>
      </div>
      {onOpenWardrobe && <WardrobeButton onClick={onOpenWardrobe} />}
      {episodeInput}
      {requiredPlayerCount > names.length && (
        <p className="ink-summary-status" role="status">
          再戦にはあと{requiredPlayerCount - names.length}人の入室が必要です
        </p>
      )}
      {onReady && (
        <button
          type="button"
          className="ink-summary-ready"
          disabled={!ready && Boolean(readyBlockedReason)}
          title={!ready ? readyBlockedReason : undefined}
          onClick={onReady}
          aria-label={ready ? "準備を取り消す" : "準備OKにする"}
          aria-pressed={ready}
        >
          <span>{ready ? "準備完了 ✓" : "準備OKにする"}</span>
          <small>
            {readyCount}/{Math.max(requiredPlayerCount, names.length)}人
          </small>
        </button>
      )}
      {onStart && (
        <button
          type="button"
          className="ink-summary-start"
          disabled={!canStart}
          title={!canStart && targetPlayerCount > 0 ? `${targetPlayerCount}人全員の準備完了が必要です` : undefined}
          onClick={onStart}
        >
          チーム決めへ
        </button>
      )}
    </div>
  );
}
