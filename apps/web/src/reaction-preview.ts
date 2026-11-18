import { reactionInkPattern } from "@gaya/shared";
/** API-facing names only. No classifier, model, or feature scoring lives here. */
export const REACTION_LEVELS = [
  "返答",
  "反応的な相槌",
  "相槌",
  "その他",
  "除外",
] as const;
export type ReactionLevel = (typeof REACTION_LEVELS)[number];
export interface ReactionDrop {
  delay: number;
  angle: number;
  reach: number;
  radius: number;
  duration: number;
  spreadRadius: number;
}
export function reactionDrops(level: ReactionLevel): ReactionDrop[] {
  switch (level) {
    // Reply reuses the existing rotating slam, triggered via activate-special.
    case "返答":
      return [];
    case "反応的な相槌":
      return reactionInkPattern("reaction-fan");
    case "相槌":
      return [];
    case "その他":
      return reactionInkPattern("reaction-pair");
    case "除外":
      return [];
  }
}
export const reactionPreview = { sequence: 0, level: "返答" as ReactionLevel };
export function previewReaction(level: ReactionLevel): void {
  reactionPreview.level = level;
  reactionPreview.sequence++;
}

export const REACTION_SHORTCUTS: Record<ReactionLevel, string> = {
  返答: "1",
  反応的な相槌: "2",
  相槌: "3",
  その他: "4",
  除外: "5",
};
export function reactionForKey(code: string): ReactionLevel | undefined {
  if (code === "KeyF") return "返答";
  const key = /^(?:Digit|Numpad)([1-5])$/.exec(code)?.[1];
  return REACTION_LEVELS.find((level) => REACTION_SHORTCUTS[level] === key);
}

export function reactionPaintKind(
  level: ReactionLevel,
): "reaction-fan" | "reaction-pair" | "ink" | null {
  return level === "反応的な相槌"
    ? "reaction-fan"
    : level === "相槌"
      ? "ink"
      : level === "その他"
        ? "reaction-pair"
        : null;
}
