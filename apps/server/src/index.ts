import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GAME_ROOM_NAME } from "@gaya/shared";
import cors from "cors";
import express from "express";
import { createReactionRouter } from "./reaction-api.js";
import { GameRoom } from "./game-room.js";

const app = express();
app.use(cors());
app.use("/api/reaction", createReactionRouter());
app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(GAME_ROOM_NAME, GameRoom);

const port = Number(process.env.PORT ?? 2567);
await gameServer.listen(port, "0.0.0.0");
console.log(`Game server listening on http://localhost:${port}`);
