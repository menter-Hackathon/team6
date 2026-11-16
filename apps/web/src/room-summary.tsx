import { useState } from "react";

interface RoomSummaryProps {
  roomCode: string;
  names: string[];
  canStart?: boolean;
  onStart?: () => void;
  onClose?: () => void;
}

export function RoomSummary({
  roomCode,
  names,
  canStart = false,
  onStart,
  onClose,
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
      {onStart && (
        <button
          className="room-summary-start"
          disabled={!canStart}
          onClick={onStart}
        >
          試合開始
        </button>
      )}
    </div>
  );
}
