import { MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("float32") x = 0;
  @type("float32") z = 0;
  @type("float32") yaw = 0;
  @type("uint32") lastProcessedInput = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
