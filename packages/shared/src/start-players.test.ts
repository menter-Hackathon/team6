import { describe, expect, it } from "vitest";
import {
  canStartWithPlayers,
  roomOptionsSchema,
  ROOM_PLAYER_COUNTS,
} from "./index.js";

describe("canStartWithPlayers", () => {
  it("allows only 4, 6 and 8 players in normal rooms", () => {
    expect(
      [2, 3, 4, 5, 6, 7, 8].filter((n) => canStartWithPlayers(n, false)),
    ).toEqual([4, 6, 8]);
  });
  it("also allows a 2-player match in developer-mode rooms", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => canStartWithPlayers(n, true)),
    ).toEqual([2, 4, 6, 8]);
  });
  it("requires the exact room size for rooms created with a selected player count", () => {
    for (const target of ROOM_PLAYER_COUNTS) {
      expect(
        roomOptionsSchema.parse({ displayName: "Host", playerCount: target })
          .playerCount,
      ).toBe(target);
      expect(
        ROOM_PLAYER_COUNTS.filter((count) =>
          canStartWithPlayers(count, false, target),
        ),
      ).toEqual([target]);
    }
    expect(
      roomOptionsSchema.safeParse({ displayName: "Host", playerCount: 3 })
        .success,
    ).toBe(false);
  });
});
