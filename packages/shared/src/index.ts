import { z } from "zod";
import { INK_VARIANT_COUNT } from "./ink-outline.js";

export const GAME_ROOM_NAME = "game";
export const playerAccessorySchema = z.enum([
  "none",
  "sunglasses",
  "glasses",
  "santa-hat",
  "straw-hat",
  "cowboy-hat",
  "eyes",
  "cat-ears",
  "tracks",
  "color-edges",
  "rgb-edges",
  "siren",
  "headphones",
  "surprised",
  "rabbit-ears",
  "halo",
  "wings",
  "wrestling-mask",
  "wind-up-key",
  "air-horn",
  "hiking-backpack",
  "pudding",
  "duckling",
  "snorkel",
  "claw-machine",
  "exhaust-fan",
  "toaster",
  "randoseru",
  "bamboo-copter",
  "hachimaki",
]);
export type PlayerAccessory = z.infer<typeof playerAccessorySchema>;
export const NEON_COLORS = [
  { name: "ピンク", hex: "#ff4f8b" },
  { name: "シアン", hex: "#37d9ff" },
  { name: "ライム", hex: "#b8ff39" },
  { name: "イエロー", hex: "#fff238" },
  { name: "オレンジ", hex: "#ff9736" },
  { name: "パープル", hex: "#b66bff" },
  { name: "グリーン", hex: "#36f5a2" },
  { name: "ブルー", hex: "#5b8cff" },
] as const;
export const teamColorRequestSchema = z.object({
  team: z.enum(["A", "B"]),
  color: z.enum(NEON_COLORS.map((entry) => entry.hex) as [string, ...string[]]),
});
export const practiceColorSchema = z.enum(
  NEON_COLORS.map((entry) => entry.hex) as [string, ...string[]],
);
export function practiceColorOwner(color: string): number {
  const index = NEON_COLORS.findIndex((entry) => entry.hex === color);
  return index < 0 ? 1 : index + 1;
}
export const SERVER_TICK_RATE = 30;
export const INPUT_SEND_RATE = 30;
export const FIELD_HALF_WIDTH = 12;
export const FIELD_HALF_DEPTH = 24;
export const PLAYER_SPEED = 5;
export const DIVE_SPEED = PLAYER_SPEED * 1.5;
export const DISC_SPEED = PLAYER_SPEED;
export const DIVE_GAP_SECONDS = 0.28;
export const INK_SHOT_INTERVAL = 0.17;
/** Auto-fire runs at 60% of the manual rate; still above the server's minimum interval. */
export const AUTO_INK_SHOT_INTERVAL = INK_SHOT_INTERVAL / 0.6;
export const REACTION_SHOT_INTERVAL = 0.32;
// Allow one frame of timing jitter when the server checks client-paced shots.
export const INK_SHOT_SERVER_TOLERANCE = 0.02;
export const PLAYER_SIZE = 1;
export const PLAYER_RADIUS = PLAYER_SIZE * 0.45;
export function teamStartPosition(team: "A" | "B", index: number, count: number) {
  const sideMargin = 3;
  const spread = FIELD_HALF_WIDTH - sideMargin;
  return {
    x: count === 1 ? 0 : -spread + (2 * spread * index) / (count - 1),
    z: (team === "A" ? -1 : 1) * (FIELD_HALF_DEPTH - sideMargin),
    yaw: team === "A" ? 0 : Math.PI,
  };
}
export const JUMP_DURATION = 0.72;
export const JUMP_HEIGHT = 1.2;
export function advanceJump(time: number, deltaSeconds: number): number {
  if (time < 0) return -1;
  const next = time + Math.max(0, deltaSeconds);
  return next >= JUMP_DURATION ? -1 : next;
}
export function jumpHeight(time: number): number {
  if (time < 0) return 0;
  return JUMP_HEIGHT * Math.sin((Math.PI * time) / JUMP_DURATION);
}
export const PRESENTATION_SECONDS = 30;
export const TALK_DURATION_OPTIONS = [10, 20, 30, 40, 50, 60] as const;
export const talkDurationSchema = z.number().int().refine(
  (seconds) => TALK_DURATION_OPTIONS.some((option) => option === seconds),
);
export const GAME_START_COUNTDOWN_SECONDS = 7;
export const TURN_INTRO_MS = 2650;
export const STARTABLE_PLAYER_COUNTS = [4, 6, 8] as const;
export const roomOptionsSchema = z.object({
  displayName: z.string().trim().min(1).max(20),
  turnOrder: z.enum(["alternating", "random"]).default("alternating"),
});
export const joinOptionsSchema = roomOptionsSchema.pick({ displayName: true });
export type TurnOrder = z.infer<typeof roomOptionsSchema>["turnOrder"];

export const moveInputSchema = z.object({
  sequence: z.number().int().nonnegative().safe(),
  x: z.number().finite().min(-1).max(1),
  z: z.number().finite().min(-1).max(1),
  yaw: z.number().finite().min(-Math.PI).max(Math.PI),
  dive: z.boolean(),
});

export type MoveInput = z.infer<typeof moveInputSchema>;

export interface PlayerSnapshot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  lastProcessedInput: number;
}

export const PAINT_GRID_SIZE = 2048;
export const INK_SCALE = 1.4;
export const INK_SPLAT_SCALE = 1.875;
/**
 * Ink size by the shooter's voice when the shot left (D-085):
 * silent 0.9x, voiced 1.2x, still speaking a long sentence 1.5x.
 */
export const INK_QUIET_SCALE = 0.9;
export const INK_VOICED_SCALE = 1.2;
export const INK_LONG_SPEECH_SCALE = 1.5;
export const inkVoiceSchema = z.enum(["voiced", "long"]);
export type InkVoice = z.infer<typeof inkVoiceSchema>;
export function inkShotScale(voice: InkVoice | undefined): number {
  return voice === "long"
    ? INK_LONG_SPEECH_SCALE
    : voice === "voiced"
      ? INK_VOICED_SCALE
      : INK_QUIET_SCALE;
}
export const paintKindSchema = z.enum([
  "reaction-fan",
  "reaction-pair",
  "ring",
  "line",
  "fan",
  "ink",
  "footprint",
  "slam",
]);
export const paintRequestSchema = z.object({
  kind: paintKindSchema.exclude(["footprint", "slam"]),
  /** Shooter's voice when the shot left; only affects `ink` size. */
  voice: inkVoiceSchema.optional(),
  pitch: z.number().finite().min(-Math.PI / 3).max(Math.PI / 3).optional(),
  /** Client-cycled splat shape for `ink`; every variant encloses the same area. */
  variant: z.number().int().min(0).max(INK_VARIANT_COUNT - 1).optional(),
});
export const specialShapeSchema = z.enum(["ink", "star", "heart"]);
export type SpecialShape = z.infer<typeof specialShapeSchema>;
export const specialRequestSchema = z.object({
  // Accept legacy requests, while keeping all current landing paint organic.
  shape: specialShapeSchema.default("ink").transform(() => "ink" as const),
});
export type PaintStroke = {
  specialShape?: SpecialShape;
  revision: number;
  /** Server-generated actor for cosmetic response motion. */
  actorId?: string;
  /** Server-generated start of a continuous walking segment. */
  fromX?: number;
  fromZ?: number;
  x: number;
  z: number;
  yaw: number;
  /** Vertical aim in radians; omitted by older clients. */
  pitch?: number;
  team: "A" | "B";
  /** Lobby-only palette color; match strokes use the assigned team. */
  practiceColor?: string;
  kind: z.infer<typeof paintKindSchema>;
  /** Server-set size multiplier for `ink` splats (see inkShotScale). */
  scale?: number;
  /** Validated splat shape index for `ink` (see INK_VARIANT_COUNT). */
  inkVariant?: number;
  /** Server-assigned area multiplier for the speaker's team. */
  areaMultiplier?: number;
};

export { rasterizePaintStroke } from "./paint-raster.js";
export { speakerTeamAreaMultiplier } from "./paint-balance.js";
export { countPaintedCells } from "./paint-result.js";
export { isFootprintOwned } from "./paint-ownership.js";

export {
  paintDisks,
  inkFlight,
  inkTravelTime,
  type PaintDisk,
} from "./paint-raster.js";
export {
  INK_VARIANT_COUNT,
  INK_VARIANT_MAX_SCALE,
  inkOutlineRadius,
  inkVariantRadius,
  isInkVariant,
  organicOutlineScale,
  organicOutlineMaxScale,
} from "./ink-outline.js";
export { updateDiveState, type DiveState } from "./dive.js";

export {
  SPECIAL_DURATION,
  SPECIAL_RADIUS,
  advanceSpecial,
  specialPose,
} from "./special.js";

export { specialOutline } from "./special-outline.js";

export { reactionInkPattern, type ReactionInkDrop } from "./reaction-ink.js";
export {
  EPISODE_MAX_LENGTH,
  episodeSchema,
  reactionLevelSchema,
  reactionRequestSchema,
  reactionResponseSchema,
  reactionEffect,
  reactionForKey,
  REACTION_KEYS,
  type ReactionLevel,
  type ReactionDecision,
  type ReactionSegment,
} from "./reaction.js";
export {
  PRESENTATION_TOPICS,
  createTopicDeck,
  pickRandomTopics,
  drawNextTopic,
  type PresentationTopic,
} from "./topics.js";
