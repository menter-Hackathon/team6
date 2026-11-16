import { useState } from "react";
import { PracticeColorPicker } from "./practice-color-picker";

interface RoomSummaryProps {
  roomCode: string;
  names: string[];
  canStart?: boolean;
  onStart?: () => void;
  onClose?: () => void;
  practiceColor?: string;
  onPracticeColorSelect?: (color: string) => void;
  ready?: boolean;
  readyCount?: number;
  onReady?: () => void;
}

export function RoomSummary({
  roomCode,
  names,
  canStart = false,
  onStart,
  onClose,
  practiceColor = "#ff4f8b",
  onPracticeColorSelect,
  ready = false,
  readyCount = 0,
  onReady,
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
    <div className="room-summary" aria-label="ルーム情報">
      {onClose && (
        <button
          className="room-summary-close"
          onClick={onClose}
          aria-label="検証プレビューを閉じる"
        >
          ×
        </button>
      )}
      <div className="room-summary-code">
        <span>招待コード</span>
        <strong>{roomCode}</strong>
      </div>
      {!onClose && (
        <>
          <button
            className="invite-link-button"
            onClick={() => void copyInviteLink()}
          >
            参加リンクをコピー
          </button>
          {linkCopyMessage && <p role="status">{linkCopyMessage}</p>}
        </>
      )}
      <ul aria-label="入室中のメンター">
        {names.map((name, index) => (
          <li key={index}>{name}</li>
        ))}
      </ul>
      <PracticeColorPicker
        color={practiceColor}
        onSelect={onPracticeColorSelect}
      />
      {onReady && (
        <button
          className="room-summary-ready"
          onClick={onReady}
          aria-label={ready ? "準備を取り消す" : "準備OKにする"}
          aria-pressed={ready}
        >
          <span>{ready ? "準備完了 ✓" : "準備OKにする"}</span>
          <span className="room-summary-ready-count">
            {readyCount}/{names.length}人
          </span>
        </button>
      )}
      {onStart && (
        <button
          className="room-summary-start"
          disabled={!canStart}
          onClick={onStart}
        >
          チーム決めへ
        </button>
      )}
    </div>
  );
}
