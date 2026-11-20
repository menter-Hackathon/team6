import { describe, expect, it, vi } from "vitest";
import { paintDisks, type PaintStroke } from "@gaya/shared";
import type { Mesh } from "three";
import { InkEffects } from "./ink-effects";

describe("ink flight effects", () => {
  it("flies from the player front toward the shared impact, shedding a few drops", () => {
    const effects = new InkEffects();
    const stroke: PaintStroke = {
      revision: 1,
      x: 2,
      z: -3,
      yaw: Math.PI / 2,
      team: "A",
      kind: "ink",
    };
    const duration = effects.emit(stroke);
    expect(duration).toBeGreaterThanOrEqual(0.12);
    expect(duration).toBeLessThan(1);
    expect(effects.group.children).toHaveLength(2);
    const main = effects.group.children[0]!;
    const trail = effects.group.children[1]! as Mesh;
    const disposeTrail = vi.spyOn(trail.geometry, "dispose");
    expect(main.position.x).toBeLessThan(stroke.x);
    const start = main.position.clone(),
      impact = paintDisks(stroke)[0]!;
    for (let i = 0; i < 8; i++) effects.update(duration / 16);
    expect(main.position.distanceTo(start)).toBeGreaterThan(1);
    expect(effects.group.children.length).toBeGreaterThan(2);
    expect(trail.visible).toBe(true);
    expect(
      Array.from(trail.geometry.getAttribute("position").array).every(
        Number.isFinite,
      ),
    ).toBe(true);
    for (let i = 0; i < 10; i++) effects.update(duration / 16);
    expect(effects.group.children).not.toContain(main);
    expect(effects.group.children).not.toContain(trail);
    expect(disposeTrail).toHaveBeenCalledTimes(1);
    expect(
      effects.group.children.some(
        (mesh) =>
          Math.abs(mesh.position.x - impact.x) < 0.01 && mesh.position.y < 0.04,
      ),
    ).toBe(true);
    for (let i = 0; i < 40; i++) effects.update(0.05);
    expect(effects.group.children).toHaveLength(0);
    effects.dispose();
    expect(disposeTrail).toHaveBeenCalledTimes(1);
  });
  it("keeps received footprints visible in order under load until each is baked", () => {
    const effects = new InkEffects();
    const stroke: PaintStroke = {
      revision: 1, kind: "footprint", team: "A", x: 0, z: 0, yaw: 0,
    };
    for (let i = 0; i < 130; i++) effects.emit(stroke);
    const a = effects.showFootprint(stroke);
    const b = effects.showFootprint({ ...stroke, team: "B" });
    expect(a.children.length).toBeGreaterThan(0);
    expect(b.children.length).toBeGreaterThan(0);
    expect(a.renderOrder).toBeLessThan(b.renderOrder);
    for (let i = 0; i < 20; i++) effects.update(0.05);
    expect(effects.group.children).toEqual([a, b]);
    expect(a.children[0]!.scale.x).toBeCloseTo(paintDisks(stroke)[0]!.radius);
    a.removeFromParent();
    expect(effects.group.children).toEqual([b]);
    effects.clear();
    expect(b.parent).toBeNull();
    effects.dispose();
  });

  it("caps cosmetic meshes under sustained multiplayer fire and clears them", () => {
    const effects = new InkEffects();
    for (let i = 0; i < 400; i++)
      effects.emit({ revision: i, x: 0, z: 0, yaw: 0, team: "B", kind: "ink" });
    expect(effects.group.children.length).toBeLessThanOrEqual(400);
    effects.clear();
    expect(effects.group.children).toHaveLength(0);
    effects.dispose();
  });
});
