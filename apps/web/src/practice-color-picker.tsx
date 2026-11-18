import { NEON_COLORS } from "@gaya/shared";

interface PracticeColorPickerProps {
  color: string;
  onSelect?: ((color: string) => void) | undefined;
}

export function PracticeColorPicker({
  color,
  onSelect,
}: PracticeColorPickerProps) {
  return (
    <section className="team-color-picker" aria-label="練習用インクの色">
      <h3>練習用インク</h3>
      <p>好きな色を選んでロビーで遊べます</p>
      <div className="team-color-swatches">
        {NEON_COLORS.map(({ name, hex }) => (
          <button
            key={hex}
            type="button"
            className={color === hex ? "selected" : ""}
            style={{ backgroundColor: hex }}
            aria-label={`練習用インクを${name}にする`}
            aria-pressed={color === hex}
            title={name}
            onClick={() => onSelect?.(hex)}
          />
        ))}
      </div>
    </section>
  );
}
