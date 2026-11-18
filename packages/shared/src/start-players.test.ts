import { describe, expect, it } from "vitest";
import { canStartWithPlayers } from "./index.js";

describe("canStartWithPlayers", () => {
  it("allows only 4, 6 and 8 players in normal rooms", () => {
    expect([2, 3, 4, 5, 6, 7, 8].filter((n) => canStartWithPlayers(n, false))).toEqual([4, 6, 8]);
  });
  it("also allows a 2-player match in developer-mode rooms", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].filter((n) => canStartWithPlayers(n, true))).toEqual([2, 4, 6, 8]);
  });
});
