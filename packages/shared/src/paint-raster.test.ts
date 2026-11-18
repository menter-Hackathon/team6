import { describe, expect, it } from "vitest";
import {
  FIELD_HALF_WIDTH,
  FIELD_HALF_DEPTH,
  INK_SCALE,
  INK_SPLAT_SCALE,
  PLAYER_SIZE,
  PAINT_GRID_SIZE,
  paintDisks,
  paintRequestSchema,
  rasterizePaintStroke,
  type PaintStroke,
} from "./index.js";
const stroke: PaintStroke = {
  revision: 1,
  x: 0,
  z: 0,
  yaw: 0,
  team: "A",
  kind: "ink",
};

describe("INK/PLAY paint geometry", () => {
  it("scales ink area by scaling radii and offsets with the square root", () => {
    const base = paintDisks(stroke);
    const boosted = paintDisks({ ...stroke, areaMultiplier: 4 / 3 });
    const scale = Math.sqrt(4 / 3);
    expect(boosted[0]!.radius / base[0]!.radius).toBeCloseTo(scale);
    expect(
      (boosted[1]!.x - boosted[0]!.x) / (base[1]!.x - base[0]!.x),
    ).toBeCloseTo(scale);
  });
  it("widens a boosted walking trail without moving its path", () => {
    const base = paintDisks({ ...stroke, kind: "footprint", fromX: 0, x: 1 });
    const boosted = paintDisks({
      ...stroke,
      kind: "footprint",
      fromX: 0,
      x: 1,
      areaMultiplier: 3 / 2,
    });
    expect(boosted[0]!.x).toBe(base[0]!.x);
    expect(boosted[0]!.z).toBe(base[0]!.z);
    expect(boosted[0]!.radius / base[0]!.radius).toBeCloseTo(Math.sqrt(3 / 2));
  });
  it("lands ahead of the player, aligned with camera-relative forward", () => {
    expect(paintDisks(stroke)[0]).toEqual({
      x: 0,
      z: 4.5,
      radius: 0.9 * INK_SCALE * INK_SPLAT_SCALE,
      organic: true,
    });
    const turned = paintDisks({ ...stroke, yaw: Math.PI / 2 })[0]!;
    expect(turned.x).toBeCloseTo(-4.5);
    expect(turned.z).toBeCloseTo(0);
  });
  it("reproduces the same splat and clips writes at arena edges", () => {
    expect(paintDisks(stroke)).toEqual(paintDisks({ ...stroke }));
    let count = 0;
    rasterizePaintStroke(
      { ...stroke, x: FIELD_HALF_WIDTH, z: FIELD_HALF_DEPTH },
      (x, y) => {
        expect(
          x >= 0 && x < PAINT_GRID_SIZE && y >= 0 && y < PAINT_GRID_SIZE,
        ).toBe(true);
        count++;
      },
    );
    expect(count).toBeGreaterThan(0);
  });
  it("allows ink shots but prevents clients choosing footprint positions", () => {
    expect(paintRequestSchema.safeParse({ kind: "ink" }).success).toBe(true);
    expect(paintRequestSchema.safeParse({ kind: "footprint" }).success).toBe(
      false,
    );
    expect(paintDisks({ ...stroke, kind: "footprint" })[0]!.radius).toBeCloseTo(
      PLAYER_SIZE / 2,
    );
  });
});

describe("continuous walking trails", () => {
  it("covers the entire moved segment with a narrow rounded line", () => {
    const cells = new Uint8Array(PAINT_GRID_SIZE ** 2);
    rasterizePaintStroke(
      { ...stroke, kind: "footprint", fromX: 0, fromZ: 0, x: 1, z: 0 },
      (x, y) => {
        cells[y * PAINT_GRID_SIZE + x] = 1;
      },
    );
    const at = (x: number, z: number) =>
      cells[
        Math.floor(
          ((z + FIELD_HALF_DEPTH) * PAINT_GRID_SIZE) / (FIELD_HALF_DEPTH * 2),
        ) *
          PAINT_GRID_SIZE +
          Math.floor(
            ((x + FIELD_HALF_WIDTH) * PAINT_GRID_SIZE) / (FIELD_HALF_WIDTH * 2),
          )
      ];
    for (let x = 0; x <= 1; x += 0.025) expect(at(x, 0)).toBe(1);
    expect(at(0.5, 0.9)).toBe(0);
  });
  it("follows a corner and does not join across a fresh trail start", () => {
    const first = paintDisks({
      ...stroke,
      kind: "footprint",
      fromX: 0,
      fromZ: 0,
      x: 1,
      z: 0,
    });
    const corner = paintDisks({
      ...stroke,
      kind: "footprint",
      fromX: 1,
      fromZ: 0,
      x: 1,
      z: 1,
    });
    expect(first.filter((d) => !d.organic).every((d) => d.z === 0)).toBe(true);
    expect(corner.filter((d) => !d.organic).every((d) => d.x === 1)).toBe(true);
    const resumed = paintDisks({
      ...stroke,
      kind: "footprint",
      fromX: 4,
      fromZ: 4,
      x: 4.1,
      z: 4,
    });
    expect(
      resumed.filter((d) => !d.organic).every((d) => d.x >= 4 && d.z === 4),
    ).toBe(true);
  });
});
