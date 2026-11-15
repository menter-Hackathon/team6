import { z } from "zod";

export const GAME_ROOM_NAME = "game";
export const SERVER_TICK_RATE = 20;
export const INPUT_SEND_RATE = 30;
export const FIELD_HALF_SIZE = 12;
export const PLAYER_SPEED = 5;
export const DIVE_SPEED = 8;
export const DISC_SPEED = 2.5;
export const PLAYER_RADIUS = 0.45;
export const PRESENTATION_SECONDS = 30;
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
export const paintKindSchema = z.enum(["ring", "line", "fan"]);
export const paintRequestSchema = z.object({ kind: paintKindSchema });
export type PaintStroke = { revision: number; x: number; z: number; yaw: number; team: "A" | "B"; kind: z.infer<typeof paintKindSchema> };

export { rasterizePaintStroke } from "./paint-raster.js";
export { isFootprintOwned } from "./paint-ownership.js";
