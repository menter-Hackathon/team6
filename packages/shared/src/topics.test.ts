import { describe, expect, it } from "vitest";
import {
  PRESENTATION_TOPICS,
  createTopicDeck,
  drawNextTopic,
} from "./index.js";

describe("presentation topics", () => {
  it("contains a non-empty list of unique topics", () => {
    expect(PRESENTATION_TOPICS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PRESENTATION_TOPICS).size).toBe(PRESENTATION_TOPICS.length);
  });

  it("creates a shuffled deck with all topics without mutating the source", () => {
    const deck = createTopicDeck(() => 0);
    expect(deck).toHaveLength(PRESENTATION_TOPICS.length);
    expect(new Set(deck)).toEqual(new Set(PRESENTATION_TOPICS));
  });

  it("draws unique topics across an 8-player match", () => {
    let deck = createTopicDeck(() => 0.37);
    const drawn: string[] = [];
    for (let turn = 0; turn < 8; turn++) {
      const next = drawNextTopic(deck, drawn.at(-1) ?? "", () => 0.37);
      drawn.push(next.topic);
      deck = next.remainingDeck;
    }
    expect(new Set(drawn).size).toBe(8);
  });

  it("avoids repeating the current topic when rerolling", () => {
    const current = PRESENTATION_TOPICS[0]!;
    const second = PRESENTATION_TOPICS[1]!;
    const next = drawNextTopic([current, second], current, () => 0);
    expect(next.topic).toBe(second);
    expect(next.remainingDeck).toEqual([current]);
  });

  it("refills the deck when empty and still avoids repeating the current topic", () => {
    const current = PRESENTATION_TOPICS[0]!;
    const next = drawNextTopic([], current, () => 0);
    expect(next.topic).not.toBe(current);
    expect(next.remainingDeck.length).toBe(PRESENTATION_TOPICS.length - 1);
  });
});
