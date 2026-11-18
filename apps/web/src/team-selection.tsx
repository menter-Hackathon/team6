import { TeamColorPicker } from "./team-color-picker";

interface TeamSelectionProps {
  players: { id: string; displayName: string; team: string }[];
  colorA: string;
  colorB: string;
  isHost: boolean;
  onColorSelect: (team: "A" | "B", color: string) => void;
  onStart: () => void;
}

export function TeamSelection({
  players,
  colorA,
  colorB,
  isHost,
  onColorSelect,
  onStart,
}: TeamSelectionProps) {
  return (
    <div className="progression-backdrop">
      <section
        className="progression-popup progression-popup--lobby"
        role="dialog"
        aria-modal="true"
        aria-label="チーム決め"
      >
        <h2>チーム決め</h2>
        <div className="team-selection-roster">
          {(["A", "B"] as const).map((team) => (
            <div key={team}>
              <strong style={{ color: team === "A" ? colorA : colorB }}>
                {team} チーム
              </strong>
              <ul>
                {players
                  .filter((player) => player.team === team)
                  .map((player) => (
                    <li key={player.id}>{player.displayName}</li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <TeamColorPicker
          colorA={colorA}
          colorB={colorB}
          editable={isHost}
          onSelect={onColorSelect}
        />
        {isHost ? (
          <button className="room-summary-start" onClick={onStart}>
            この2色で試合開始
          </button>
        ) : (
          <p>ルームマスターが試合の色を選んでいます</p>
        )}
      </section>
    </div>
  );
}
