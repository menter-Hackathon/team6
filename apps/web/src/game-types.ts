import type { MapSchema } from "@colyseus/schema";

export interface PlayerState {
  id: string;
  displayName: string;
  ready: boolean;
  team: string;
  practiceColor: string;
  x: number;
  z: number;
  yaw: number;
  specialTime: number;
  jumpTime: number;
  dive: boolean;
  submerged: boolean;
  lastProcessedInput: number;
  hasEpisode: boolean;
}

export interface GameState {
  players: MapSchema<PlayerState>;
  scoreA: number;
  scoreB: number;
  phase: string;
  hostId: string;
  colorA: string;
  colorB: string;
  turnOrder: string;
  turnIndex: number;
  turnEndsAt: number;
  countdownEndsAt: number;
  talkDuration: number;
  replayPlayerCount: number;
  speakerOrder: string[];
}
