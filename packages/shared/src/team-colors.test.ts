import { describe, expect, it } from "vitest";
import { NEON_COLORS, teamColorRequestSchema } from "./index.js";

describe("team color requests", () => {
  it("accepts only the eight available colors and valid team names", () => {
    expect(NEON_COLORS).toHaveLength(8);
    for (const { hex } of NEON_COLORS)
      expect(
        teamColorRequestSchema.safeParse({ team: "A", color: hex }).success,
      ).toBe(true);
    expect(
      teamColorRequestSchema.safeParse({
        team: "C",
        color: NEON_COLORS[0]!.hex,
      }).success,
    ).toBe(false);
    expect(
      teamColorRequestSchema.safeParse({ team: "A", color: "#000000" }).success,
    ).toBe(false);
  });
});
