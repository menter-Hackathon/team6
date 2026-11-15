import { z } from "zod";

export const GAME_ROOM_NAME = "game";
export const SERVER_TICK_RATE = 20;
export const INPUT_SEND_RATE = 30;
export const FIELD_HALF_SIZE = 12;
export const PLAYER_SPEED = 5;
export const PLAYER_RADIUS = 0.45;

export const moveInputSchema = z.object({
  sequence: z.number().int().nonnegative().safe(),
  x: z.number().finite().min(-1).max(1),
  z: z.number().finite().min(-1).max(1),
  yaw: z.number().finite().min(-Math.PI).max(Math.PI),
});

export type MoveInput = z.infer<typeof moveInputSchema>;

export interface PlayerSnapshot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  lastProcessedInput: number;
}
