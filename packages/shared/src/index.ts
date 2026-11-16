import { z } from "zod";

export const GAME_ROOM_NAME = "game";
export const SERVER_TICK_RATE = 20;
export const INPUT_SEND_RATE = 30;
export const FIELD_HALF_SIZE = 12;
export const PLAYER_SPEED = 5;
export const DIVE_SPEED = PLAYER_SPEED * 1.5;
export const DISC_SPEED = PLAYER_SPEED;
export const DIVE_GAP_SECONDS = 0.28;
export const INK_SHOT_INTERVAL = 0.17;
export const PLAYER_SIZE = 1;
export const PLAYER_RADIUS = PLAYER_SIZE * 0.45;
export const PRESENTATION_SECONDS = 30;
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
export const paintKindSchema = z.enum([
  "ring",
  "line",
  "fan",
  "ink",
  "footprint",
  "slam",
]);
export const paintRequestSchema = z.object({
  kind: paintKindSchema.exclude(["footprint", "slam"]),
});
export const specialShapeSchema = z.enum(["ink", "star", "heart"]);
export type SpecialShape = z.infer<typeof specialShapeSchema>;
export const specialRequestSchema = z.object({
  shape: specialShapeSchema.default("star"),
});
export type PaintStroke = {
  specialShape?: SpecialShape;
  revision: number;
  /** Server-generated start of a continuous walking segment. */
  fromX?: number;
  fromZ?: number;
  x: number;
  z: number;
  yaw: number;
  team: "A" | "B";
  kind: z.infer<typeof paintKindSchema>;
};

export { rasterizePaintStroke } from "./paint-raster.js";
export { isFootprintOwned } from "./paint-ownership.js";

export {
  paintDisks,
  inkOutlineRadius,
  type PaintDisk,
} from "./paint-raster.js";
export { updateDiveState, type DiveState } from "./dive.js";

export {
  SPECIAL_DURATION,
  SPECIAL_RADIUS,
  advanceSpecial,
  specialPose,
} from "./special.js";

export { specialOutline } from "./special-outline.js";
