import { useRef } from "react";
import * as THREE from "three";
import { specialPose, SPECIAL_DURATION } from "@gaya/shared";

/** Runs after the dive appearance; animation stays outside React state. */
export function useSpecialAppearance() {
  const clock = useRef(-1),
    previous = useRef(-1),
    recovery = useRef(1);
  return (
    body: THREE.Mesh | null,
    time: number,
    delta: number,
    shotAge = Infinity,
  ) => {
    if (!body) return;
    body.rotation.set(0, 0, 0);
    body.scale.set(1, 1, 1);
    if (time >= 0) {
      clock.current =
        previous.current < 0 || time < previous.current
          ? time
          : Math.min(SPECIAL_DURATION, Math.max(time, clock.current + delta));
      const pose = specialPose(clock.current),
        width = 1 / Math.sqrt(pose.scaleY);
      body.visible = true;
      body.position.y = pose.height + pose.scaleY * 0.5;
      body.rotation.set(pose.flip, pose.spin, 0);
      body.scale.set(width, pose.scaleY, width);
      recovery.current = 0;
    } else if (previous.current >= 0 || recovery.current < 0.16) {
      recovery.current += delta;
      const compression = 0.3 * Math.exp(-recovery.current * 22),
        width = 1 / Math.sqrt(1 - compression);
      body.visible = true;
      body.scale.set(width, 1 - compression, width);
      body.position.y = (1 - compression) * 0.5;
      clock.current = -1;
    }
    if (time < 0 && shotAge >= 0 && shotAge < 0.25) {
      const pulse = Math.exp(-shotAge * 18);
      body.scale.multiply(
        new THREE.Vector3(
          1 - 0.035 * pulse,
          1 - 0.12 * pulse,
          1 - 0.035 * pulse,
        ),
      );
      body.position.y -= 0.06 * pulse;
    }
    previous.current = time;
  };
}
