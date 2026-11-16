import { describe, expect, it } from "vitest";
import {
  FIELD_HALF_SIZE,
  INK_SCALE,
  PAINT_GRID_SIZE,
  SPECIAL_RADIUS,
  paintDisks,
  rasterizePaintStroke,
  specialRequestSchema,
  type PaintStroke,
} from "./index.js";
const base: PaintStroke = {
  revision: 1,
  x: 0,
  z: 0,
  yaw: 0,
  team: "A",
  kind: "slam",
};
const scale = SPECIAL_RADIUS * INK_SCALE;
function painted(shape: "star" | "heart") {
  const cells = new Uint8Array(PAINT_GRID_SIZE ** 2);
  rasterizePaintStroke({ ...base, specialShape: shape }, (x, y) => {
    cells[y * PAINT_GRID_SIZE + x] = 1;
  });
  return (x: number, z: number) =>
    cells[
      Math.floor(
        ((z * scale + FIELD_HALF_SIZE) * PAINT_GRID_SIZE) /
          (FIELD_HALF_SIZE * 2),
      ) *
        PAINT_GRID_SIZE +
        Math.floor(
          ((x * scale + FIELD_HALF_SIZE) * PAINT_GRID_SIZE) /
            (FIELD_HALF_SIZE * 2),
        )
    ] === 1;
}
describe("special ink silhouettes", () => {
  it("preserves a heart's lobes, cleft and tip", () => {
    const heart = painted("heart");
    expect(heart(-0.4, 0.6)).toBe(true);
    expect(heart(0.4, 0.6)).toBe(true);
    expect(heart(0, 0.7)).toBe(false);
    expect(heart(0, -0.7)).toBe(true);
  });
  it("keeps a star's main tip and valleys", () => {
    const star = painted("star");
    expect(star(0, 0)).toBe(true);
    expect(star(0, 0.85)).toBe(true);
    expect(star(0.62, 0.6)).toBe(false);
  });
  it("validates shape requests and reproduces the same server/client shape", () => {
    expect(specialRequestSchema.parse({}).shape).toBe("star");
    expect(specialRequestSchema.safeParse({ shape: "other" }).success).toBe(
      false,
    );
    expect(specialRequestSchema.parse({ shape: "heart" }).shape).toBe("heart");
    expect(specialRequestSchema.parse({ shape: "ink" }).shape).toBe("ink");
    const normal = paintDisks({ ...base, specialShape: "ink" })[0]!;
    expect(normal.organic).toBe(true);
    expect(normal.outlineShape).toBeUndefined();
    expect(paintDisks({ ...base, specialShape: "heart" })).toEqual(
      paintDisks({ ...base, specialShape: "heart" }),
    );
  });
});
