import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") displayName = "";
  @type("boolean") ready = false;
  @type("string") team = "";
  @type("string") practiceColor = "#ff4f8b";
  @type("float32") x = 0;
  @type("float32") z = 0;
  @type("float32") yaw = 0;
  @type("float32") specialTime = -1;
  @type("float32") jumpTime = -1;
  @type("boolean") dive = false;
  @type("boolean") submerged = false;
  @type("uint32") lastProcessedInput = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("uint32") scoreA = 0;
  @type("uint32") scoreB = 0;
  @type("string") phase = "lobby";
  @type("string") hostId = "";
  @type("string") colorA = "#ff4f8b";
  @type("string") colorB = "#37d9ff";
  @type("string") turnOrder = "alternating";
  @type("uint32") turnIndex = 0;
  @type("float64") turnEndsAt = 0;
  @type(["string"]) speakerOrder = new ArraySchema<string>();
}
