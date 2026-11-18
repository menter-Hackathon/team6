import { Client, Room } from "@colyseus/core";
import { randomBytes } from "node:crypto";
import {
  PRESENTATION_SECONDS,
  GAME_START_COUNTDOWN_SECONDS,
  TURN_INTRO_MS,
  advanceSpecial,
  specialRequestSchema,
  type SpecialShape,
  SERVER_TICK_RATE,
  STARTABLE_PLAYER_COUNTS,
  joinOptionsSchema,
  moveInputSchema,
  paintRequestSchema,
  type PaintStroke,
  INK_SHOT_INTERVAL,
  REACTION_SHOT_INTERVAL,
  INK_SHOT_SERVER_TOLERANCE,
  updateDiveState,
  type DiveState,
  roomOptionsSchema,
  teamColorRequestSchema,
  practiceColorSchema,
  practiceColorOwner,
  advanceJump,
  type MoveInput,
} from "@gaya/shared";
import { GameState, PlayerState } from "./game-state.js";
import { PaintField } from "./paint.js";
import { deflateSync } from "node:zlib";
import { movePlayer, movementSpeed } from "./movement.js";

const IDLE_INPUT: MoveInput = { sequence: 0, x: 0, z: 0, yaw: 0, dive: false };

export class GameRoom extends Room<{ state: GameState }> {
  override maxClients = 8;
  private readonly movementInputs = new Map<string, MoveInput>();
  private readonly paint = new PaintField();
  private readonly lastPaint = new Map<string, number>();
  private readonly lastReactionPaint = new Map<string, number>();
  private readonly specialShapes = new Map<string, SpecialShape>();
  private readonly dives = new Map<string, DiveState>();
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
      if (this.state.phase !== "playing" && this.state.phase !== "lobby")
        return;
      const result = moveInputSchema.safeParse(payload);
      if (!result.success) return;

      const previous = this.movementInputs.get(client.sessionId);
      if (previous && result.data.sequence <= previous.sequence) return;
      this.movementInputs.set(client.sessionId, result.data);
    });
    this.onMessage("paint", (client, payload: unknown) => {
      const practice = this.state.phase === "lobby";
      if (!practice && this.state.phase !== "playing") return;
      const parsed = paintRequestSchema.safeParse(payload);
      const player = this.state.players.get(client.sessionId);
      if (
        !parsed.success ||
        !player ||
        player.dive ||
        player.specialTime >= 0 ||
        (!practice && player.team !== "A" && player.team !== "B")
      )
        return;
      const now = Date.now();
      const clock =
        parsed.data.kind === "reaction-fan"
          ? this.lastReactionPaint
          : this.lastPaint;
      if (
        now - (clock.get(client.sessionId) ?? 0) <
        (parsed.data.kind === "reaction-fan"
          ? REACTION_SHOT_INTERVAL * 1000
          : parsed.data.kind === "ink"
            ? (INK_SHOT_INTERVAL - INK_SHOT_SERVER_TOLERANCE) * 1000
            : 500)
      )
        return;
      clock.set(client.sessionId, now);
      const stroke: PaintStroke = {
        revision: this.paint.revision + 1,
        actorId: client.sessionId,
        x: player.x,
        z: player.z,
        yaw: player.yaw,
        team: player.team === "B" ? "B" : "A",
        ...(practice ? { practiceColor: player.practiceColor } : {}),
        kind: parsed.data.kind,
      };
      this.paint.apply(stroke);
      if (!practice) {
        this.state.scoreA = this.paint.counts[1]!;
        this.state.scoreB = this.paint.counts[2]!;
      }
      this.broadcast("paint", stroke);
    });
    this.onMessage("special", (client, payload: unknown) => {
      const request = specialRequestSchema.safeParse(payload);
      if (!request.success) return;
      const player = this.state.players.get(client.sessionId);
      const practice = this.state.phase === "lobby";
      if (!practice && this.state.phase !== "playing") return;
      if (
        !player ||
        player.specialTime >= 0 ||
        (!practice && player.team !== "A" && player.team !== "B")
      )
        return;
      this.specialShapes.set(client.sessionId, request.data.shape);
      player.specialTime = 0;
      player.jumpTime = -1;
      player.dive = false;
      player.submerged = false;
      this.dives.delete(client.sessionId);
    });
    this.onMessage("jump", (client) => {
      if (this.state.phase !== "lobby" && this.state.phase !== "playing")
        return;
      const player = this.state.players.get(client.sessionId);
      if (!player || player.jumpTime >= 0 || player.specialTime >= 0) return;
      player.jumpTime = 0;
      player.dive = false;
      player.submerged = false;
      this.dives.delete(client.sessionId);
    });
    this.onMessage("paint-snapshot", (client) =>
      this.sendPaintSnapshot(client),
    );
    this.onMessage("ready", (client, payload: unknown) => {
      if (this.state.phase !== "lobby" || typeof payload !== "boolean") return;
      const player = this.state.players.get(client.sessionId);
      if (player) player.ready = payload;
    });
    this.onMessage("team-color", (client, payload: unknown) => {
      if (
        this.state.phase !== "team_selection" ||
        client.sessionId !== this.state.hostId
      )
        return;
      const parsed = teamColorRequestSchema.safeParse(payload);
      if (!parsed.success) return;
      const { team, color } = parsed.data;
      if (color === (team === "A" ? this.state.colorB : this.state.colorA))
        return;
      if (team === "A") this.state.colorA = color;
      else this.state.colorB = color;
    });
    this.onMessage("practice-color", (client, payload: unknown) => {
      if (this.state.phase !== "lobby") return;
      const parsed = practiceColorSchema.safeParse(payload);
      if (!parsed.success) return;
      const player = this.state.players.get(client.sessionId);
      if (player) player.practiceColor = parsed.data;
    });
    this.onMessage("prepare-teams", (client) => {
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
        player.specialTime = -1;
        player.jumpTime = -1;
        player.dive = false;
        player.submerged = false;
      });
      this.dives.clear();
      this.movementInputs.forEach((_, sessionId) => {
        this.movementInputs.set(sessionId, { ...IDLE_INPUT });
      });
      const order =
        this.state.turnOrder === "random"
          ? shuffled
          : this.alternatingOrder(shuffled);
      this.state.speakerOrder.push(...order.map((player) => player.id));
      this.state.phase = "team_selection";
    });
    this.onMessage("start", (client) => {
      if (
        client.sessionId !== this.state.hostId ||
        this.state.phase !== "team_selection"
      )
        return;
      this.paint.reset();
      this.state.scoreA = 0;
      this.state.scoreB = 0;
      this.broadcast("paint-snapshot", {
        revision: this.paint.revision,
        data: deflateSync(this.paint.cells).toString("base64"),
      });
      this.state.phase = "countdown";
      setTimeout(() => {
        if (this.state.phase !== "countdown") return;
        this.state.phase = "playing";
        this.advanceTurn();
        this.turnTimer = setInterval(() => {
          if (Date.now() >= this.state.turnEndsAt) this.advanceTurn();
        }, 250);
      }, GAME_START_COUNTDOWN_SECONDS * 1000);
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
    this.lastReactionPaint.delete(client.sessionId);
    this.dives.delete(client.sessionId);
    this.specialShapes.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (this.state.phase === "team_selection") {
      this.state.phase = "lobby";
      this.state.speakerOrder.clear();
      this.state.players.forEach((player) => {
        player.team = "";
        player.ready = false;
      });
    }
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
    client.send("paint-snapshot", {
      revision: this.paint.revision,
      data: deflateSync(this.paint.cells).toString("base64"),
    });
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
    this.state.turnEndsAt =
      Date.now() + TURN_INTRO_MS + PRESENTATION_SECONDS * 1000;
    this.state.turnIndex += 1;
  }

  private update(deltaSeconds: number): void {
    if (this.state.phase !== "lobby" && this.state.phase !== "playing") return;
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      const input = this.movementInputs.get(sessionId) ?? IDLE_INPUT;
      const practice = this.state.phase === "lobby";
      const team = practice
        ? practiceColorOwner(player.practiceColor)
        : player.team === "A"
          ? 1
          : player.team === "B"
            ? 2
            : -1;
      const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);
      player.jumpTime = advanceJump(player.jumpTime, dt);
      const diveRequested = input.dive && player.jumpTime < 0;
      if (player.specialTime >= 0) {
        const special = advanceSpecial(player.specialTime, dt);
        player.specialTime =
          this.state.phase === "playing" || practice ? special.time : -1;
        player.dive = false;
        player.submerged = false;
        player.lastProcessedInput = input.sequence;
        if (
          special.landed &&
          (this.state.phase === "playing" || practice) &&
          (practice || player.team === "A" || player.team === "B")
        ) {
          const stroke: PaintStroke = {
            revision: this.paint.revision + 1,
            x: player.x,
            z: player.z,
            yaw: player.yaw,
            team: player.team === "B" ? "B" : "A",
            ...(practice ? { practiceColor: player.practiceColor } : {}),
            kind: "slam",
            specialShape: this.specialShapes.get(sessionId) ?? "ink",
          };
          this.paint.apply(stroke);
          if (!practice) {
            this.state.scoreA = this.paint.counts[1]!;
            this.state.scoreB = this.paint.counts[2]!;
          }
          this.broadcast("paint", stroke);
        }
        return;
      }
      const previous = this.dives.get(sessionId) ?? {
        submerged: false,
        gapSeconds: 0,
        team,
      };
      const before = updateDiveState(
        previous,
        diveRequested,
        this.paint.fullyOwnedAt(player.x, player.z, team),
        0,
        team,
      );
      const next = movePlayer(
        player,
        input,
        dt,
        movementSpeed(diveRequested, before.submerged),
      );
      const after = updateDiveState(
        before,
        diveRequested,
        this.paint.fullyOwnedAt(next.x, next.z, team),
        dt,
        team,
      );
      this.dives.set(sessionId, after);
      player.dive = diveRequested;
      player.submerged = after.submerged;
      const distance = Math.hypot(next.x - player.x, next.z - player.z);
      const fromX = player.x,
        fromZ = player.z;
      player.x = next.x;
      player.z = next.z;
      if (
        !diveRequested &&
        player.jumpTime < 0 &&
        distance > 0.001 &&
        (this.state.phase === "playing" || practice) &&
        (practice || player.team === "A" || player.team === "B")
      ) {
        const footprint: PaintStroke = {
          revision: this.paint.revision + 1,
          fromX,
          fromZ,
          x: next.x,
          z: next.z,
          yaw: input.yaw,
          team: player.team === "B" ? "B" : "A",
          ...(practice ? { practiceColor: player.practiceColor } : {}),
          kind: "footprint",
        };
        this.paint.apply(footprint);
        if (!practice) {
          this.state.scoreA = this.paint.counts[1]!;
          this.state.scoreB = this.paint.counts[2]!;
        }
        this.broadcast("paint", footprint);
      }
      player.yaw = input.yaw;
      player.lastProcessedInput = input.sequence;
    });
  }
}
