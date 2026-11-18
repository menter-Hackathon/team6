import { useId, useState } from "react";
import { EPISODE_MAX_LENGTH } from "@gaya/shared";

interface EpisodeInputProps {
  /** Whether the server has a non-empty story for this player. */
  saved: boolean;
  /** How many players in the room have entered a story. */
  enteredCount: number;
  playerCount: number;
  onSave: (text: string) => void;
}

/**
 * The story the player will tell on their turn (D-090). The server uses it only to judge
 * whether others' gaya relate to the story; it is not shown to other players.
 */
export function EpisodeInput({
  saved,
  enteredCount,
  playerCount,
  onSave,
}: EpisodeInputProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState<string | null>(null);
  const trimmed = text.trim();
  const dirty = savedText === null ? trimmed.length > 0 : trimmed !== savedText;
  const save = () => {
    if (!dirty) return;
    onSave(trimmed);
    setSavedText(trimmed);
  };
  return (
    <div className="episode-input">
      <label htmlFor={id}>あなたが話すエピソード</label>
      <textarea
        id={id}
        value={text}
        maxLength={EPISODE_MAX_LENGTH}
        rows={3}
        placeholder="例：昨日駅前のラーメン屋で1時間並んだ話"
        onChange={(event) => setText(event.target.value)}
        onBlur={save}
      />
      <div className="episode-input-footer">
        <span>
          {dirty ? "未保存" : saved ? "保存済み ✓" : "未入力"}
          {" · "}入力済み {enteredCount}/{playerCount}人
        </span>
        <button onClick={save} disabled={!dirty}>
          保存
        </button>
      </div>
      <p>
        あなたの発表ターンで、ほかの人のガヤが話に関係あるかの判定に使います。ほかの人には表示されません。
      </p>
    </div>
  );
}
