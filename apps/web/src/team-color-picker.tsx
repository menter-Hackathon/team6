import { NEON_COLORS } from "@gaya/shared";

interface TeamColorPickerProps {
  colorA: string;
  colorB: string;
  editable: boolean;
  onSelect?: ((team: "A" | "B", color: string) => void) | undefined;
}

export function TeamColorPicker({
  colorA,
  colorB,
  editable,
  onSelect,
}: TeamColorPickerProps) {
  return (
    <section className="team-color-picker" aria-label="試合で使うインクの色">
      <h3>インクの色</h3>
      <p>
        {editable ? "2チームの色を8色から選択" : "ルーム作成者が色を選択中"}
      </p>
      {(["A", "B"] as const).map((team) => {
        const selected = team === "A" ? colorA : colorB;
        const other = team === "A" ? colorB : colorA;
        return (
          <div className="team-color-row" key={team}>
            <strong>{team} チーム</strong>
            <div className="team-color-swatches">
              {NEON_COLORS.map(({ name, hex }) => (
                <button
                  key={hex}
                  type="button"
                  className={selected === hex ? "selected" : ""}
                  style={{ backgroundColor: hex }}
                  aria-label={`${team} チームを${name}にする`}
                  aria-pressed={selected === hex}
                  title={name}
                  disabled={!editable || (hex === other && hex !== selected)}
                  onClick={() => onSelect?.(team, hex)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
