import { Client, Room } from "@colyseus/core";
import { randomBytes } from "node:crypto";
import {
  PRESENTATION_SECONDS,
  SERVER_TICK_RATE,
  STARTABLE_PLAYER_COUNTS,
  joinOptionsSchema,
  moveInputSchema,
  paintRequestSchema,
  type PaintStroke,
  roomOptionsSchema,
  type MoveInput,
} from "@gaya/shared";
import { GameState, PlayerState } from "./game-state.js";
import { PaintField } from "./paint.js";
import { deflateSync } from "node:zlib";
import { movePlayer } from "./movement.js";

const IDLE_INPUT: MoveInput = { sequence: 0, x: 0, z: 0, yaw: 0 };

export class GameRoom extends Room<{ state: GameState }> {
  override maxClients = 8;
  private readonly movementInputs = new Map<string, MoveInput>();
  private readonly paint = new PaintField();
  private readonly lastPaint = new Map<string, number>();
  private turnTimer: ReturnType<typeof setInterval> | undefined;

  override onCreate(options: unknown): void {
    const settings = roomOptionsSchema.parse(options);
    this.roomId = randomBytes(4).toString("hex").toUpperCase();
    this.setState(new GameState());
    this.state.turnOrder = settings.turnOrder;
    this.setPatchRate(1000 / SERVER_TICK_RATE);
    this.setSimulationInterval(
      (deltaMilliseconds) => this.update(deltaMilliseconds / 1000),
      1000 / SERVER_TICK_RATE,
    );

    this.onMessage("move", (client, payload: unknown) => {
      if (this.state.phase !== "playing" && this.state.phase !== "lobby") return;
      const result = moveInputSchema.safeParse(payload);
      if (!result.success) return;

      const previous = this.movementInputs.get(client.sessionId);
      if (previous && result.data.sequence <= previous.sequence) return;
      this.movementInputs.set(client.sessionId, result.data);
    });
    this.onMessage("paint", (client, payload: unknown) => {
      if (this.state.phase !== "playing") return;
      const parsed = paintRequestSchema.safeParse(payload);
      const player = this.state.players.get(client.sessionId);
      if (!parsed.success || !player || (player.team !== "A" && player.team !== "B")) return;
      const now = Date.now();
      if (now - (this.lastPaint.get(client.sessionId) ?? 0) < 500) return;
      this.lastPaint.set(client.sessionId, now);
      const stroke: PaintStroke = { revision: this.paint.revision + 1, x: player.x, z: player.z, yaw: player.yaw, team: player.team, kind: parsed.data.kind };
      this.paint.apply(stroke);
      this.state.scoreA = this.paint.counts[1]!;
      this.state.scoreB = this.paint.counts[2]!;
      this.broadcast("paint", stroke);
    });
    this.onMessage("paint-snapshot", (client) => this.sendPaintSnapshot(client));
    this.onMessage("ready", (client, payload: unknown) => {
      if (this.state.phase !== "lobby" || typeof payload !== "boolean") return;
      const player = this.state.players.get(client.sessionId);
      if (player) player.ready = payload;
    });
    this.onMessage("start", (client) => {
      if (
        client.sessionId !== this.state.hostId ||
        this.state.phase !== "lobby"
      )
        return;
      const players = Array.from(this.state.players.values());
      if (
        !STARTABLE_PLAYER_COUNTS.some((count) => count === players.length) ||
        players.some((player) => !player.ready)
      )
        return;
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      shuffled.forEach((player, index) => {
        player.team = index < shuffled.length / 2 ? "A" : "B";
      });
      const order =
        this.state.turnOrder === "random"
          ? shuffled
          : this.alternatingOrder(shuffled);
      this.state.speakerOrder.push(...order.map((player) => player.id));
      this.state.phase = "countdown";
      setTimeout(() => {
        if (this.state.phase !== "countdown") return;
        this.state.phase = "playing";
        this.advanceTurn();
        this.turnTimer = setInterval(() => {
          if (Date.now() >= this.state.turnEndsAt) this.advanceTurn();
        }, 250);
      }, 3000);
    });
  }

  override onJoin(client: Client, options: unknown): void {
    const { displayName } = joinOptionsSchema.parse(options);
    if (this.state.phase !== "lobby") throw new Error("MATCH_STARTED");
    const player = new PlayerState();
    player.id = client.sessionId;
    player.displayName = displayName;
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    const playerNumber = this.state.players.size;
    player.x = (playerNumber % 4) * 2 - 3;
    player.z = Math.floor(playerNumber / 4) * 2 - 1;
    this.state.players.set(client.sessionId, player);
    this.movementInputs.set(client.sessionId, { ...IDLE_INPUT });
    this.sendPaintSnapshot(client);
  }

  override onLeave(client: Client): void {
    this.movementInputs.delete(client.sessionId);
    this.lastPaint.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (this.state.phase === "lobby") {
      this.state.players.forEach((player) => {
        player.ready = false;
      });
    }
    if (this.state.hostId === client.sessionId) {
      this.state.hostId = this.state.players.keys().next().value ?? "";
    }
  }

  override onDispose(): void {
    if (this.turnTimer) clearInterval(this.turnTimer);
    this.state.phase = "closed";
  }

  private sendPaintSnapshot(client: Client): void {
    client.send("paint-snapshot", { revision: this.paint.revision, data: deflateSync(this.paint.cells).toString("base64") });
  }

  private alternatingOrder(players: PlayerState[]): PlayerState[] {
    const a = players.filter((player) => player.team === "A");
    const b = players.filter((player) => player.team === "B");
    return a.flatMap((player, index) => [player, b[index]!]);
  }

  private advanceTurn(): void {
    while (
      this.state.turnIndex < this.state.speakerOrder.length &&
      !this.state.players.has(this.state.speakerOrder[this.state.turnIndex]!)
    ) {
      this.state.turnIndex += 1;
    }
    if (this.state.turnIndex >= this.state.speakerOrder.length) {
      this.state.phase = "result";
      this.state.turnEndsAt = 0;
      if (this.turnTimer) clearInterval(this.turnTimer);
      return;
    }
    this.state.turnEndsAt = Date.now() + PRESENTATION_SECONDS * 1000;
    this.state.turnIndex += 1;
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
