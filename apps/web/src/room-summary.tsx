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
