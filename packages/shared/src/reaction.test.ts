import { expect, it } from "vitest";
import {
  reactionEffect,
  reactionForKey,
  reactionRequestSchema,
  reactionResponseSchema,
} from "./reaction.js";
import {
  paintDisks,
  paintRequestSchema,
  rasterizePaintStroke,
  type PaintStroke,
  specialRequestSchema,
} from "./index.js";

it("maps the supplied four levels to keys 1/2/3 and no ink for exclusion", () => {
  expect(["Digit1", "Numpad2", "Digit3", "Digit4"].map(reactionForKey)).toEqual(
    ["長い文章", "短い相槌", "迷い", "除外"],
  );
  expect(
    ["長い文章", "短い相槌", "迷い", "除外"].map((level) =>
      reactionEffect(reactionResponseSchema.parse({ level }).level),
    ),
  ).toEqual(["slam", "reaction-fan", "ink", null]);
  expect(reactionForKey("Digit9")).toBeUndefined();
  expect(
    reactionResponseSchema.safeParse({ level: "unexpected" }).success,
  ).toBe(false);
});
it("validates bounded Japanese input and accepts omitted context", () => {
  expect(reactionRequestSchema.parse({ reaction: " なるほど " })).toEqual({
    reaction: "なるほど",
    source: "",
    userNames: [],
  });
  for (const reaction of ["", " ", "あ".repeat(501)])
    expect(reactionRequestSchema.safeParse({ reaction }).success).toBe(false);
  expect(
    reactionRequestSchema.safeParse({
      reaction: "うん",
      source: "あ".repeat(2001),
    }).success,
  ).toBe(false);
});
it("keeps the existing wide five-drop fan paint in shared rendering and ownership geometry", () => {
  expect(paintRequestSchema.safeParse({ kind: "reaction-fan" }).success).toBe(
    true,
  );
  const stroke: PaintStroke = {
    revision: 1,
    x: 0,
    z: 0,
    yaw: 0,
    kind: "reaction-fan",
    team: "A",
  };
  const disks = paintDisks(stroke);
  expect(disks).toHaveLength(5);
  expect(
    Math.max(...disks.map((d) => d.x)) - Math.min(...disks.map((d) => d.x)),
  ).toBeGreaterThan(4);
  for (const disk of disks) {
    expect(disk.organic).toBe(true);
    expect(disk.radius).toBeCloseTo(1.365);
  }
  const cells = new Set<string>();
  rasterizePaintStroke(stroke, (x, y) => cells.add(`${x}:${y}`));
  expect(cells.size).toBeGreaterThan(1000);
});

it("bounds username lists without rejecting the existing request format", () => {
  expect(
    reactionRequestSchema.parse({ reaction: "太郎さん", userNames: [" 太郎 "] })
      .userNames,
  ).toEqual(["太郎"]);
  for (const userNames of [
    [""],
    ["  "],
    ["あ".repeat(21)],
    Array(33).fill("太郎"),
  ])
    expect(
      reactionRequestSchema.safeParse({ reaction: "太郎さん", userNames })
        .success,
    ).toBe(false);
});

it("uses normal ink for every new landing, including legacy shape requests", () => {
  for (const request of [
    {},
    { shape: "ink" },
    { shape: "star" },
    { shape: "heart" },
  ])
    expect(specialRequestSchema.parse(request)).toEqual({ shape: "ink" });
});

it("validates all segment levels before any of them can reach paint", () => {
  expect(
    reactionResponseSchema.safeParse({
      level: "短い相槌",
      segments: [
        { text: "なるほど", level: "短い相槌" },
        { text: "すごい", level: "invalid" },
      ],
    }).success,
  ).toBe(false);
});
