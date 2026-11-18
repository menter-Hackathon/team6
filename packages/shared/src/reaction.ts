import { z } from "zod";

export const reactionLevelSchema = z.enum([
  "長い文章",
  "短い相槌",
  "迷い",
  "除外",
]);
export type ReactionLevel = z.infer<typeof reactionLevelSchema>;
export const reactionRequestSchema = z.object({
  reaction: z.string().trim().min(1).max(500),
  source: z.string().trim().max(2000).default(""),
  userNames: z.array(z.string().trim().min(1).max(20)).max(32).default([]),
});
export const reactionSegmentSchema = z.object({
  text: z.string().min(1).max(500),
  level: reactionLevelSchema,
});
export const reactionResponseSchema = z.object({
  level: reactionLevelSchema,
  streamable: z.boolean().optional(),
  segments: z.array(reactionSegmentSchema).min(2).max(500).optional(),
});
export type ReactionDecision = z.infer<typeof reactionResponseSchema>;
export type ReactionSegment = z.infer<typeof reactionSegmentSchema>;
export const REACTION_KEYS: Record<ReactionLevel, string> = {
  長い文章: "1",
  短い相槌: "2",
  迷い: "3",
  除外: "4",
};
export function reactionEffect(
  level: ReactionLevel,
): "slam" | "reaction-fan" | "ink" | null {
  switch (level) {
    case "長い文章":
      return "slam";
    case "短い相槌":
      return "reaction-fan";
    case "迷い":
      return "ink";
    case "除外":
      return null;
  }
}
export function reactionForKey(code: string): ReactionLevel | undefined {
  const key = /^(?:Digit|Numpad)([1-4])$/.exec(code)?.[1];
  return reactionLevelSchema.options.find(
    (level) => REACTION_KEYS[level] === key,
  );
}
