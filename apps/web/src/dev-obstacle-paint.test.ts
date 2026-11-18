import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import {
  wallContours,
  topContours,
  sweptInkContact,
  adjacentFaceStamps,
} from "./dev-obstacle-paint";
const bounds = new Box3(new Vector3(2.5, 0, 7), new Vector3(5.5, 2.4, 9));
describe("ink edge contact with obstacle faces", () => {
  it("keeps elevated star paint on the matching top plane, preserving its rotation", () => {
    const disk = {
      x: 4,
      z: 8,
      radius: 4,
      outlineShape: "star" as const,
      rotation: 0.4,
    };
    const contacts = topContours([disk], 2.4);
    const top = contacts.find((c) => c.box === 3)!;
    expect(top.face).toBe(4);
    expect(top.points.length).toBeGreaterThan(50);
    expect(topContours([disk], 0)).toEqual([]);
    expect(topContours([{ ...disk, x: 30, z: 30 }], 2.4)).toEqual([]);
    expect(
      topContours([{ ...disk, rotation: 0 }], 2.4).find((c) => c.box === 3)!
        .points,
    ).not.toEqual(top.points);
  });
  it("projects all three slam shapes and ordinary area paint onto box tops", () => {
    for (const disk of [
      { x: 4, z: 8, radius: 3, organic: true },
      { x: 4, z: 8, radius: 3, outlineShape: "heart" as const },
      { x: 4, z: 8, radius: 0.5 },
    ]) {
      expect(
        topContours([disk], 2.4).some((c) => c.box === 3 && c.face === 4),
      ).toBe(true);
    }
  });
  it("hits when the droplet edge clips a wall although its centre misses", () => {
    const hit = sweptInkContact(
      new Vector3(5.7, 1, 6),
      new Vector3(5.7, 1, 9),
      0.3,
      bounds,
    );
    expect(hit).not.toBeNull();
    expect(hit!.x).toBe(5.5);
    expect(
      sweptInkContact(
        new Vector3(5.9, 1, 6),
        new Vector3(5.9, 1, 9),
        0.3,
        bounds,
      ),
    ).toBeNull();
  });
  it("does not use the square expanded-box corner as a sphere contact", () => {
    expect(
      sweptInkContact(
        new Vector3(5.75, 1, 6.75),
        new Vector3(5.75, 1, 6.8),
        0.3,
        bounds,
      ),
    ).toBeNull();
    expect(
      sweptInkContact(
        new Vector3(5.7, 1, 6.8),
        new Vector3(5.7, 1, 6.9),
        0.3,
        bounds,
      ),
    ).not.toBeNull();
  });
  it("handles contact at the start of a short path", () => {
    expect(
      sweptInkContact(
        new Vector3(4, 1, 6.8),
        new Vector3(4, 1, 6.9),
        0.3,
        bounds,
      )?.z,
    ).toBe(7);
  });
  it("unfolds the floor splat's touching portion up the wall without moving the floor centre", () => {
    const contours = wallContours([{ x: 4, z: 6, radius: 2 }], { x: 4, z: 0 });
    const front = contours.find(
      (contour) => contour.box === 3 && contour.face === 1,
    )!;
    expect(front).toBeDefined();
    expect(Math.max(...front.points.map((point) => point.height))).toBeCloseTo(
      1,
    );
    expect(Math.min(...front.points.map((point) => point.height))).toBeLessThan(
      0,
    );
    expect(
      contours.some((contour) => contour.box === 3 && contour.face === 0),
    ).toBe(false);
  });
  it("does not paint when the spread stops short, and preserves the organic outline", () => {
    expect(
      wallContours([{ x: 4, z: 5, radius: 1 }], { x: 4, z: 0 }),
    ).toHaveLength(0);
    const round = wallContours([{ x: 4, z: 6, radius: 2 }], {
      x: 4,
      z: 0,
    }).find((c) => c.box === 3 && c.face === 1)!;
    const ink = wallContours([{ x: 4, z: 6, radius: 2, organic: true }], {
      x: 4,
      z: 0,
    }).find((c) => c.box === 3 && c.face === 1)!;
    expect(ink.points).not.toEqual(round.points);
  });
  it("spreads around a shared edge, but does not paint the opposite face", () => {
    const contacts = adjacentFaceStamps(3, new Vector3(5.45, 1, 7), 1.05);
    expect(contacts.map((c) => c.face)).toContain(1);
    expect(contacts.map((c) => c.face)).toContain(2);
    expect(contacts.map((c) => c.face)).not.toContain(0);
    expect(contacts.map((c) => c.face)).not.toContain(3);
  });
});
