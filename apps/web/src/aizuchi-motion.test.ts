import { expect, it } from "vitest";
import { aizuchiPose, AIZUCHI_MOTION_SECONDS } from "./aizuchi-motion";
it("squashes before the spring and returns the cube to its original size", () => {
  expect(aizuchiPose(0.07).size).toBeCloseTo(0.58);
  expect(aizuchiPose(0.07).width * aizuchiPose(0.07).size).toBeLessThan(0.7);
  expect(aizuchiPose(0.16).size).toBeCloseTo(1.4);
  expect(aizuchiPose(0.195).height).toBeCloseTo(0.85);
  expect(aizuchiPose(0.07).height).toBe(0);
  expect(aizuchiPose(0.32).height).toBeCloseTo(0);
  expect(aizuchiPose(0.15).scaleY).toBeGreaterThan(1);
  expect(aizuchiPose(AIZUCHI_MOTION_SECONDS)).toEqual(aizuchiPose(-1));
  for (let age = 0; age < AIZUCHI_MOTION_SECONDS; age += 0.01) {
    const pose = aizuchiPose(age);
    expect(pose.height).toBeGreaterThanOrEqual(0);
    expect(pose.pitch).toBe(0);
    expect(pose.roll).toBe(0);
    expect(pose.width * pose.width * pose.scaleY).toBeCloseTo(1);
  }
});
