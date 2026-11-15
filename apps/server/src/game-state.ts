import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") displayName = "";
  @type("boolean") ready = false;
  @type("string") team = "";
  @type("float32") x = 0;
  @type("float32") z = 0;
  @type("float32") yaw = 0;
  @type("uint32") lastProcessedInput = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("string") phase = "lobby";
  @type("string") hostId = "";
  @type("string") turnOrder = "alternating";
  @type("uint32") turnIndex = 0;
  @type("float64") turnEndsAt = 0;
  @type(["string"]) speakerOrder = new ArraySchema<string>();
}
