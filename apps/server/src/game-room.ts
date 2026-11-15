import { Client, Room } from "@colyseus/core";
import {
  SERVER_TICK_RATE,
  moveInputSchema,
  type MoveInput,
} from "@gaya/shared";
import { GameState, PlayerState } from "./game-state.js";
import { movePlayer } from "./movement.js";

const IDLE_INPUT: MoveInput = { sequence: 0, x: 0, z: 0, yaw: 0 };

export class GameRoom extends Room<{ state: GameState }> {
  override maxClients = 8;
  private readonly movementInputs = new Map<string, MoveInput>();

  override onCreate(): void {
    this.setState(new GameState());
    this.setPatchRate(1000 / SERVER_TICK_RATE);
    this.setSimulationInterval(
      (deltaMilliseconds) => this.update(deltaMilliseconds / 1000),
      1000 / SERVER_TICK_RATE,
    );

    this.onMessage("move", (client, payload: unknown) => {
      const result = moveInputSchema.safeParse(payload);
      if (!result.success) return;

      const previous = this.movementInputs.get(client.sessionId);
      if (previous && result.data.sequence <= previous.sequence) return;
      this.movementInputs.set(client.sessionId, result.data);
    });
  }

  override onJoin(client: Client): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    const playerNumber = this.state.players.size;
    player.x = (playerNumber % 4) * 2 - 3;
    player.z = Math.floor(playerNumber / 4) * 2 - 1;
    this.state.players.set(client.sessionId, player);
    this.movementInputs.set(client.sessionId, { ...IDLE_INPUT });
  }

  override onLeave(client: Client): void {
    this.movementInputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private update(deltaSeconds: number): void {
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      const input = this.movementInputs.get(sessionId) ?? IDLE_INPUT;
      const next = movePlayer(player, input, Math.min(deltaSeconds, 0.1));
      player.x = next.x;
      player.z = next.z;
      player.yaw = input.yaw;
      player.lastProcessedInput = input.sequence;
    });
  }
}
