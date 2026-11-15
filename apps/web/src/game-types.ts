import type { MapSchema } from "@colyseus/schema";

export interface PlayerState {
  id: string;
  x: number;
  z: number;
  yaw: number;
  lastProcessedInput: number;
}

export interface GameState {
  players: MapSchema<PlayerState>;
}
