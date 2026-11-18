import { describe, expect, it } from "vitest";
import {
  PRESENTATION_TOPICS,
  TOPIC_THINKING_SECONDS,
  createTopicDeck,
  drawNextTopic,
  pickRandomTopics,
} from "./index.js";

describe("presentation topics", () => {
  it("defines a 60-second thinking timer and unique topics", () => {
    expect(TOPIC_THINKING_SECONDS).toBe(60);
    expect(PRESENTATION_TOPICS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PRESENTATION_TOPICS).size).toBe(PRESENTATION_TOPICS.length);
  });

  it("creates a shuffled deck with all topics without mutating the source", () => {
    const deck = createTopicDeck(() => 0);
    expect(deck).toHaveLength(PRESENTATION_TOPICS.length);
    expect(new Set(deck)).toEqual(new Set(PRESENTATION_TOPICS));
  });

  it("picks multiple non-duplicate random topic suggestions avoiding excluded ones", () => {
    const firstBatch = pickRandomTopics(3, [], () => 0.25);
    expect(firstBatch).toHaveLength(3);
    expect(new Set(firstBatch).size).toBe(3);

    const secondBatch = pickRandomTopics(3, firstBatch, () => 0.5);
    expect(secondBatch).toHaveLength(3);
    expect(new Set(secondBatch).size).toBe(3);
    for (const topic of secondBatch) {
      expect(firstBatch).not.toContain(topic);
    }
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
});
