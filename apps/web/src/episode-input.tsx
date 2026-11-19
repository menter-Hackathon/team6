import { useId } from "react";
import { EPISODE_MAX_LENGTH } from "@gaya/shared";

/** Owned by the app so the text survives switching between lobby views. */
export interface EpisodeDraft {
  text: string;
  /** What was last sent to the server; null until the first save. */
  savedText: string | null;
}

export const EMPTY_EPISODE_DRAFT: EpisodeDraft = { text: "", savedText: null };

interface EpisodeInputProps {
  draft: EpisodeDraft;
  onDraftChange: (draft: EpisodeDraft) => void;
  /** Whether the server has a non-empty story for this player. */
  saved: boolean;
  /** How many players in the room have entered a story. */
  enteredCount: number;
  playerCount: number;
  onSave: (text: string) => void;
}

export function EpisodeInput({
  draft,
  onDraftChange,
  saved,
  enteredCount,
  playerCount,
  onSave,
}: EpisodeInputProps) {
  const id = useId();
  const trimmed = draft.text.trim();
  const dirty =
    draft.savedText === null ? trimmed.length > 0 : trimmed !== draft.savedText;
  const save = () => {
    if (!dirty) return;
    onSave(trimmed);
    onDraftChange({ text: draft.text, savedText: trimmed });
  };
  return (
    <div className="episode-input">
      <label htmlFor={id}>あなたが話すエピソード</label>
      <textarea
        id={id}
        value={draft.text}
        maxLength={EPISODE_MAX_LENGTH}
        aria-describedby={`${id}-sharing`}
        rows={3}
        placeholder="例：昨日駅前のラーメン屋で1時間並んだ話"
        onChange={(event) =>
          onDraftChange({ text: event.target.value, savedText: draft.savedText })
        }
        onBlur={save}
      />
      <p id={`${id}-sharing`}>
        あなたの発表ターン中、ここに入力した内容が全員に表示されます。
      </p>
      <div className="episode-input-footer">
        <span>
          {dirty ? "未保存" : saved ? "保存済み ✓" : "未入力"}
          {" · "}入力済み {enteredCount}/{playerCount}人
        </span>
        <button onClick={save} disabled={!dirty}>
          保存
        </button>
      </div>
    </div>
  );
}
