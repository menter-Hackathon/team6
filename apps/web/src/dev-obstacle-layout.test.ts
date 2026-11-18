import { describe, expect, it } from "vitest";
import {
  obstacleFloor,
  obstacleMove,
  BOX_HEIGHT,
  paintedWall,
  obstacleInk,
  surfacePaintOwned,
} from "./dev-obstacle-layout";
describe("development obstacle platforms", () => {
  it("requires own wall paint before allowing a wall climb", () => {
    expect(paintedWall(-4, 6.5, 0, "#ff4f8b")).toBeNull();
    obstacleInk.sample = (_box, _face, _u, _v, color) => color === "#ff4f8b";
    expect(paintedWall(-4, 6.5, 0, "#ff4f8b")).toMatchObject({
      nx: 0,
      nz: -1,
      z: 7,
    });
    expect(paintedWall(-4, 6.5, 0, "#37d9ff")).toBeNull();
    expect(paintedWall(0, 0, 0, "#ff4f8b")).toBeNull();
    expect(paintedWall(-4, 6.5, BOX_HEIGHT, "#ff4f8b")).toBeNull();
    obstacleInk.sample = () => false;
  });
  it("blocks walking through a box and allows passing above its top", () => {
    expect(obstacleMove(-4, 6, -4, 7.2, 0).z).toBe(6.5);
    expect(obstacleMove(-4, 6, -4, 7.2, BOX_HEIGHT).z).toBe(7.2);
  });
  it("allows movement along a side and supplies the platform height", () => {
    expect(obstacleMove(-6, 7.5, -5.5, 8, 0)).toEqual({ x: -6, z: 8 });
    expect(obstacleFloor(-4, 8)).toBe(BOX_HEIGHT);
    expect(obstacleFloor(0, 0)).toBe(0);
    expect(obstacleFloor(-4, 10)).toBe(0);
  });
});

it("checks top-face ink independently of the ground beneath an obstacle", () => {
  obstacleInk.sample = () => false;
  expect(surfacePaintOwned(-4, 8, BOX_HEIGHT, "#ff4f8b", () => true)).toBe(
    false,
  );
  obstacleInk.sample = (box, face, u, v, color) =>
    box === 2 && face === 4 && u === 0 && v === 0 && color === "#ff4f8b";
  expect(surfacePaintOwned(-4, 8, BOX_HEIGHT, "#ff4f8b", () => false)).toBe(
    true,
  );
  expect(surfacePaintOwned(-4, 8, BOX_HEIGHT, "#37d9ff", () => true)).toBe(
    false,
  );
  expect(surfacePaintOwned(0, 0, 0, "#ff4f8b", () => true)).toBe(true);
  expect(surfacePaintOwned(-4, 8, BOX_HEIGHT + 1, "#ff4f8b", () => true)).toBe(
    false,
  );
  obstacleInk.sample = () => false;
});
