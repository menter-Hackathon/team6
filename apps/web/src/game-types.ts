import type { MapSchema } from "@colyseus/schema";

export interface PlayerState {
  id: string;
  displayName: string;
  ready: boolean;
  team: string;
  x: number;
  z: number;
  yaw: number;
  lastProcessedInput: number;
}

export interface GameState {
  players: MapSchema<PlayerState>;
  phase: string;
  hostId: string;
  turnOrder: string;
  turnIndex: number;
  turnEndsAt: number;
  speakerOrder: string[];
}
