import { expect, it } from "vitest";
import { InkEffects } from "./ink-effects";
import { paintDisks, type PaintStroke } from "@gaya/shared";
it("animates the five liquid drops and settles on the authoritative fan disks", () => {
  const effects = new InkEffects();
  const stroke: PaintStroke = {
    revision: 1,
    x: 0,
    z: 0,
    yaw: 0,
    kind: "reaction-fan",
    team: "A",
  };
  const flight = effects.emit(stroke);
  expect(flight).toBeCloseTo(0.266);
  // Each drop has a mesh and a liquid trail.
  expect(effects.group.children).toHaveLength(11);
  expect(effects.group.getObjectByName("aizuchi-wave")).toBeDefined();
  const disks = paintDisks(stroke);
  for (let i = 0; i < 6; i++) effects.update(0.05);
  for (const disk of disks)
    expect(
      effects.group.children.some(
        (mesh) =>
          Math.abs(mesh.position.x - disk.x) < 0.001 &&
          Math.abs(mesh.position.z - disk.z) < 0.001 &&
          Math.abs(mesh.position.y - 0.027) < 0.001,
      ),
    ).toBe(true);
  for (let i = 0; i < 30; i++) effects.update(0.05);
  expect(effects.group.children).toHaveLength(0);
  effects.dispose();
});

it("keeps normal click ink and its duration separate from the stronger response effect", () => {
  const effects = new InkEffects();
  const duration = effects.emit({
    revision: 1,
    x: 0,
    z: 0,
    yaw: 0,
    kind: "ink",
    team: "A",
  });
  expect(duration).toBeGreaterThan(0);
  expect(effects.group.children).toHaveLength(2);
  expect(effects.group.getObjectByName("aizuchi-wave")).toBeUndefined();
  effects.dispose();
});
