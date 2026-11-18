import { describe, expect, it } from "vitest";
import {
  INK_VARIANT_COUNT,
  INK_VARIANT_MAX_SCALE,
  inkOutlineRadius,
  inkVariantRadius,
  paintDisks,
  paintRequestSchema,
  rasterizePaintStroke,
  type PaintStroke,
} from "./index.js";

function outlineArea(radius: (angle: number) => number): number {
  const samples = 4096;
  let sum = 0;
  for (let i = 0; i < samples; i++)
    sum += radius((i / samples) * Math.PI * 2) ** 2;
  return (sum / samples) * Math.PI;
}

function cellCount(stroke: PaintStroke): number {
  let count = 0;
  rasterizePaintStroke(stroke, () => count++);
  return count;
}

const shot: PaintStroke = {
  revision: 1,
  x: 0,
  z: 0,
  yaw: 0.4,
  team: "A",
  kind: "ink",
};

describe("ink splat variants", () => {
  it("encloses the same area as the legacy outline for every variant", () => {
    const reference = outlineArea(inkOutlineRadius);
    for (let v = 0; v < INK_VARIANT_COUNT; v++)
      expect(outlineArea((a) => inkVariantRadius(v, a))).toBeCloseTo(
        reference,
        2,
      );
  });

  it("produces distinct, stable shapes", () => {
    const signature = (v: number) =>
      [0.3, 1.7, 2.9, 4.4].map((a) => inkVariantRadius(v, a).toFixed(4)).join();
    const all = Array.from({ length: INK_VARIANT_COUNT }, (_, v) => signature(v));
    expect(new Set(all).size).toBe(INK_VARIANT_COUNT);
    expect(signature(3)).toBe(all[3]);
  });

  it("keeps rasterization bounds around every outline", () => {
    for (let v = 0; v < INK_VARIANT_COUNT; v++)
      for (let i = 0; i < 256; i++)
        expect(inkVariantRadius(v, (i / 256) * Math.PI * 2)).toBeLessThanOrEqual(
          INK_VARIANT_MAX_SCALE,
        );
  });

  it("claims about the same territory whichever variant is thrown", () => {
    const legacy = cellCount(shot);
    for (let v = 0; v < INK_VARIANT_COUNT; v++)
      expect(Math.abs(cellCount({ ...shot, inkVariant: v }) / legacy - 1)).toBeLessThan(
        0.03,
      );
  });

  it("orients the variant along the shot and ignores invalid indices", () => {
    const disk = paintDisks({ ...shot, inkVariant: 2 })[0]!;
    expect(disk.variant).toBe(2);
    expect(disk.rotation).toBeCloseTo(Math.atan2(Math.cos(0.4), -Math.sin(0.4)));
    expect(paintDisks({ ...shot, inkVariant: 99 })[0]!.variant).toBeUndefined();
    expect(paintDisks({ ...shot, inkVariant: 1.5 })[0]!.variant).toBeUndefined();
  });

  it("validates the requested variant", () => {
    expect(paintRequestSchema.safeParse({ kind: "ink", variant: 0 }).success).toBe(true);
    expect(
      paintRequestSchema.safeParse({ kind: "ink", variant: INK_VARIANT_COUNT - 1 })
        .success,
    ).toBe(true);
    for (const variant of [-1, INK_VARIANT_COUNT, 0.5, "1"])
      expect(paintRequestSchema.safeParse({ kind: "ink", variant }).success).toBe(false);
  });
});
