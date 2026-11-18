import { afterEach, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createReactionRouter } from "./reaction-api.js";
import { ReactionEvaluator } from "./reaction-evaluator.js";
import {
  registerEpisodeSource,
  unregisterEpisodeSource,
} from "./episode-sources.js";
let server: Server | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
});
async function serve(evaluator: ReactionEvaluator) {
  const app = express();
  app.use("/api/reaction", createReactionRouter(evaluator));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}/api/reaction`;
}
it("evaluates Japanese text in Node and sends only level with no-store", async () => {
  const evaluate = vi.fn(async () => ({
    level: "除外",
    scores: { private: 1 },
  }));
  const api = await serve(new ReactionEvaluator(async () => evaluate));
  const response = await fetch(`${api}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reaction: "あー" }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ level: "除外" });
  expect(evaluate).toHaveBeenCalledWith({ source: "", reaction: "あー" });
});
it("validates input before loading and exposes unavailable service without painting", async () => {
  const load = vi.fn(async () => {
    throw new Error("private filesystem path");
  });
  const api = await serve(new ReactionEvaluator(load));
  const invalid = await fetch(`${api}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reaction: "" }),
  });
  expect(invalid.status).toBe(400);
  expect(load).not.toHaveBeenCalled();
  const failed = await fetch(`${api}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reaction: "その店どこ" }),
  });
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({ code: "REACTION_UNAVAILABLE" });
  expect(await (await fetch(`${api}/status`)).json()).toEqual({
    state: "error",
  });
});

it("accepts usernames from the request and returns aizuchi without a model", async () => {
  const load = vi.fn(async () => {
    throw new Error("must not load");
  });
  const api = await serve(new ReactionEvaluator(load));
  const response = await fetch(`${api}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reaction: "太郎さん、それは本当に大変だったね",
      userNames: ["太郎"],
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ level: "短い相槌" });
  expect(load).not.toHaveBeenCalled();
});

it("returns separately judged aizuchi in one response", async () => {
  const evaluate = vi.fn(async () => ({ level: "短い相槌" }));
  const api = await serve(new ReactionEvaluator(async () => evaluate));
  const response = await fetch(`${api}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reaction: "すげえ、マジか天才" }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    level: "短い相槌",
    streamable: true,
    segments: [
      { text: "すげえ", level: "短い相槌" },
      { text: "まじか", level: "短い相槌" },
      { text: "天才", level: "短い相槌" },
    ],
  });
  expect(evaluate).toHaveBeenCalledTimes(3);
});

it("uses the current speaker's entered story as the source for a room, without returning it", async () => {
  const evaluate = vi.fn(async () => ({ level: "除外" }));
  const api = await serve(new ReactionEvaluator(async () => evaluate));
  const story = "駅前のラーメン屋で1時間並んだ話";
  registerEpisodeSource("ROOM1", () => story);
  try {
    const post = (body: object) =>
      fetch(`${api}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const response = await post({
      reaction: "2000円って書いてある",
      roomId: "ROOM1",
    });
    expect(await response.json()).toEqual({ level: "除外" });
    expect(evaluate).toHaveBeenLastCalledWith({
      source: story,
      reaction: "2000円って書いてある",
    });
    // Unknown room: falls back to the request's own source.
    await post({
      reaction: "それはやばい",
      roomId: "NOPE",
      source: "手入力の話",
    });
    expect(evaluate).toHaveBeenLastCalledWith({
      source: "手入力の話",
      reaction: "それはやばい",
    });
  } finally {
    unregisterEpisodeSource("ROOM1");
  }
});
