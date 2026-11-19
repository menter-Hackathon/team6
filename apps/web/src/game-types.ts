import type { MapSchema } from "@colyseus/schema";
import type { PlayerAccessory } from "@gaya/shared";

export interface PlayerState {
  id: string;
  displayName: string;
  ready: boolean;
  team: string;
  practiceColor: string;
  x: number;
  z: number;
  height: number;
  climbing: boolean;
  yaw: number;
  specialTime: number;
  jumpTime: number;
  dive: boolean;
  submerged: boolean;
  lastProcessedInput: number;
  hasEpisode: boolean;
  accessory: PlayerAccessory;
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
  turnTopic: string;
  turnEndsAt: number;
  countdownEndsAt: number;
  talkDuration: number;
  replayPlayerCount: number;
  devMatch: boolean;
  speakerOrder: string[];
}
