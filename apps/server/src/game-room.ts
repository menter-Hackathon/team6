import { Client, Room } from "@colyseus/core";
import { randomBytes } from "node:crypto";
import {
  talkDurationSchema,
  GAME_START_COUNTDOWN_SECONDS,
  TURN_INTRO_MS,
  advanceSpecial,
  specialRequestSchema,
  type SpecialShape,
  SERVER_TICK_RATE,
  canStartWithPlayers,
  joinOptionsSchema,
  moveInputSchema,
  paintRequestSchema,
  type PaintStroke,
  INK_SHOT_INTERVAL,
  inkShotScale,
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
  episodeSchema,
  countPaintedCells,
  speakerTeamAreaMultiplier,
  teamStartPosition,
} from "@gaya/shared";
import { GameState, PlayerState } from "./game-state.js";
import {
  registerEpisodeSource,
  unregisterEpisodeSource,
} from "./episode-sources.js";
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
  /** Entered stories by session id (D-090). Server memory only; never synced. */
  private readonly episodes = new Map<string, string>();

  override onCreate(options: unknown): void {
    const settings = roomOptionsSchema.parse(options);
    this.roomId = randomBytes(4).toString("hex").toUpperCase();
    this.setState(new GameState());
    this.state.turnOrder = settings.turnOrder;
    this.state.talkDuration = settings.talkDuration;
    this.state.devMatch = settings.devMatch;
    registerEpisodeSource(this.roomId, () => this.currentEpisode());
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
      const practice = this.state.phase === "lobby";
      if (!practice && this.state.phase !== "playing") return;
      const parsed = paintRequestSchema.safeParse(payload);
      const player = this.state.players.get(client.sessionId);
      if (
        !parsed.success ||
        !player ||
        (!practice && this.isSpeaker(client.sessionId)) ||
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
        ...(parsed.data.kind === "ink" ? { pitch: parsed.data.pitch ?? 0 } : {}),
        team: player.team === "B" ? "B" : "A",
        ...(practice ? { practiceColor: player.practiceColor } : {}),
        kind: parsed.data.kind,
        ...(parsed.data.kind === "ink"
          ? { scale: inkShotScale(parsed.data.voice) }
          : {}),
        ...(parsed.data.kind === "ink" && parsed.data.variant !== undefined
          ? { inkVariant: parsed.data.variant }
          : {}),
        areaMultiplier: this.paintAreaMultiplier(player),
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
        (!practice && this.isSpeaker(client.sessionId)) ||
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
      if (this.state.phase !== "lobby" && this.state.phase !== "playing") return;
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
    this.onMessage("episode", (client, payload: unknown) => {
      if (this.state.phase === "result" || this.state.phase === "closed")
        return;
      const parsed = episodeSchema.safeParse(payload);
      const player = this.state.players.get(client.sessionId);
      if (!parsed.success || !player) return;
      if (parsed.data) this.episodes.set(client.sessionId, parsed.data);
      else this.episodes.delete(client.sessionId);
      player.hasEpisode = parsed.data.length > 0;
      // Clearing the episode also clears readiness (ready requires an episode).
      if (!player.hasEpisode) player.ready = false;
    });
    this.onMessage("ready", (client, payload: unknown) => {
      if (this.state.phase !== "lobby" || typeof payload !== "boolean") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      // A player can get ready only after entering the episode they will tell.
      if (payload && !this.episodes.has(client.sessionId)) return;
      player.ready = payload;
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
    this.onMessage("talk-duration", (client, payload: unknown) => {
      if (this.state.phase !== "team_selection" || client.sessionId !== this.state.hostId) return;
      const parsed = talkDurationSchema.safeParse(payload);
      if (parsed.success) this.state.talkDuration = parsed.data;
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
        !canStartWithPlayers(players.length, this.state.devMatch) ||
        (this.state.replayPlayerCount > 0 && players.length !== this.state.replayPlayerCount) ||
        players.some((player) => !player.ready)
      )
        return;
      this.paint.reset();
      this.broadcast("paint-snapshot", {
        revision: this.paint.revision,
        data: deflateSync(this.paint.cells).toString("base64"),
      });
      this.assignTeams(players);
      players.forEach((player) => {
        player.specialTime = -1;
        player.jumpTime = -1;
        player.dive = false;
        player.submerged = false;
      });
      this.dives.clear();
      this.movementInputs.forEach((_, sessionId) => {
        this.movementInputs.set(sessionId, { ...IDLE_INPUT });
      });
      this.state.phase = "team_selection";
    });
    this.onMessage("reshuffle-teams", (client) => {
      if (
        client.sessionId !== this.state.hostId ||
        this.state.phase !== "team_selection"
      ) return;
      this.assignTeams(Array.from(this.state.players.values()));
    });
    this.onMessage("replay", (client) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== "result") return;
      const players = Array.from(this.state.players.values());
      if (
        !canStartWithPlayers(players.length, this.state.devMatch) ||
        players.filter((player) => player.team === "A").length !== players.length / 2 ||
        players.filter((player) => player.team === "B").length !== players.length / 2
      ) return;
      this.paint.reset();
      this.lastPaint.clear();
      this.state.scoreA = 0;
      this.state.scoreB = 0;
      this.state.turnIndex = 0;
      this.state.turnEndsAt = 0;
      this.state.countdownEndsAt = 0;
      this.state.replayPlayerCount = players.length;
      this.broadcast("paint-snapshot", {
        revision: this.paint.revision,
        data: deflateSync(this.paint.cells).toString("base64"),
      });
      this.state.phase = "team_selection";
    });
    this.onMessage("return-to-lobby", (client) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== "team_selection") return;
      this.state.phase = "lobby";
      this.state.replayPlayerCount = 0;
      this.state.speakerOrder.clear();
      this.state.players.forEach((player) => {
        player.team = "";
        player.ready = false;
      });
    });
    this.onMessage("start", (client) => {
      if (
        client.sessionId !== this.state.hostId ||
        this.state.phase !== "team_selection"
      )
        return;
      const players = Array.from(this.state.players.values());
      if (
        !canStartWithPlayers(players.length, this.state.devMatch) ||
        (this.state.replayPlayerCount > 0 && players.length !== this.state.replayPlayerCount) ||
        players.some((player) => !player.ready) ||
        players.filter((player) => player.team === "A").length !== players.length / 2 ||
        players.filter((player) => player.team === "B").length !== players.length / 2
      ) return;
      this.state.replayPlayerCount = 0;
      this.paint.reset();
      this.lastPaint.clear();
      const teams = {
        A: Array.from(this.state.players.values()).filter((player) => player.team === "A"),
        B: Array.from(this.state.players.values()).filter((player) => player.team === "B"),
      };
      this.state.players.forEach((player, sessionId) => {
        const team = player.team === "B" ? "B" : "A";
        const position = teamStartPosition(team, teams[team].indexOf(player), teams[team].length);
        player.x = position.x;
        player.z = position.z;
        player.yaw = position.yaw;
        player.jumpTime = -1;
        player.specialTime = -1;
        player.dive = false;
        player.submerged = false;
        this.movementInputs.set(sessionId, { ...IDLE_INPUT });
      });
      this.dives.clear();
      this.state.scoreA = 0;
      this.state.scoreB = 0;
      this.broadcast("paint-snapshot", {
        revision: this.paint.revision,
        data: deflateSync(this.paint.cells).toString("base64"),
      });
      this.state.phase = "countdown";
      this.state.countdownEndsAt = Date.now() + GAME_START_COUNTDOWN_SECONDS * 1000;
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
    this.episodes.delete(client.sessionId);
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
    unregisterEpisodeSource(this.roomId);
    this.episodes.clear();
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

  /** The current speaker's entered story, used as the source for others' gaya. */
  private currentEpisode(): string {
    if (this.state.phase !== "playing" || this.state.turnIndex === 0) return "";
    const speaker = this.state.speakerOrder[this.state.turnIndex - 1];
    return speaker ? (this.episodes.get(speaker) ?? "") : "";
  }

  private assignTeams(players: PlayerState[]): void {
    const previous = players.map((player) => player.team).join("");
    let shuffled: PlayerState[];
    do {
      shuffled = [...players];
      for (let index = shuffled.length - 1; index > 0; index--) {
        const swap = randomBytes(4).readUInt32BE(0) % (index + 1);
        [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
      }
      shuffled.forEach((player, index) => {
        player.team = index < shuffled.length / 2 ? "A" : "B";
      });
    } while (shuffled.length > 1 && players.map((player) => player.team).join("") === previous);
    const order = this.state.turnOrder === "random"
      ? shuffled
      : this.alternatingOrder(shuffled);
    this.state.speakerOrder.splice(0, this.state.speakerOrder.length, ...order.map((player) => player.id));
  }

  private isSpeaker(sessionId: string): boolean {
    return (
      this.state.phase === "playing" &&
      this.state.speakerOrder[this.state.turnIndex - 1] === sessionId
    );
  }

  private paintAreaMultiplier(player: PlayerState): number {
    if (this.state.phase !== "playing" || !this.state.speakerOrder.length)
      return 1;
    const speakerId = this.state.speakerOrder[this.state.turnIndex - 1];
    const speaker = speakerId && this.state.players.get(speakerId);
    if (!speaker || speaker.team !== player.team) return 1;
    const teamSize = this.state.speakerOrder.length / 2;
    return speakerTeamAreaMultiplier(teamSize);
  }

  private advanceTurn(): void {
    while (
      this.state.turnIndex < this.state.speakerOrder.length &&
      !this.state.players.has(this.state.speakerOrder[this.state.turnIndex]!)
    ) {
      this.state.turnIndex += 1;
    }
    if (this.state.turnIndex >= this.state.speakerOrder.length) {
      const { scoreA, scoreB } = countPaintedCells(this.paint.cells);
      this.state.scoreA = scoreA;
      this.state.scoreB = scoreB;
      this.state.phase = "result";
      this.state.turnEndsAt = 0;
      if (this.turnTimer) clearInterval(this.turnTimer);
      return;
    }
    this.state.turnEndsAt =
      Date.now() + TURN_INTRO_MS + this.state.talkDuration * 1000;
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
          (practice || !this.isSpeaker(sessionId)) &&
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
            areaMultiplier: this.paintAreaMultiplier(player),
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
        (practice || !this.isSpeaker(sessionId)) &&
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
          areaMultiplier: this.paintAreaMultiplier(player),
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
