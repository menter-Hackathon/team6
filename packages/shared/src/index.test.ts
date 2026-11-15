import { describe, expect, it } from "vitest";
import { moveInputSchema } from "./index.js";

describe("moveInputSchema", () => {
  it("accepts a normalized movement input", () => {
    expect(
      moveInputSchema.safeParse({ sequence: 1, x: 0.5, z: -1, yaw: 0, dive: false }),
    ).toHaveProperty("success", true);
  });

  it("rejects out-of-range and unknown movement values", () => {
    expect(
      moveInputSchema.safeParse({ sequence: 1, x: 2, z: 0, yaw: 0, dive: false }),
    ).toHaveProperty("success", false);
  });
});
