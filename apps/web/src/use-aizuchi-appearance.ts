import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { aizuchiPose, AIZUCHI_MOTION_SECONDS } from "./aizuchi-motion";

export function useAizuchiAppearance(actorId: string) {
  const age = useRef(AIZUCHI_MOTION_SECONDS);
  useEffect(() => {
    const start = (event: Event) => {
      if ((event as CustomEvent).detail?.actorId === actorId) age.current = 0;
    };
    window.addEventListener("aizuchi-motion", start);
    return () => window.removeEventListener("aizuchi-motion", start);
  }, [actorId]);
  return (body: THREE.Mesh | null, delta: number, blocked: boolean) => {
    if (blocked) {
      age.current = AIZUCHI_MOTION_SECONDS;
      return;
    }
    if (!body || age.current >= AIZUCHI_MOTION_SECONDS) return;
    const pose = aizuchiPose(age.current);
    body.scale.multiplyScalar(pose.width * pose.size);
    body.scale.y = pose.scaleY * pose.size;
    body.position.y += pose.height + (pose.scaleY * pose.size - 1) * 0.5;
    body.rotation.x += pose.pitch;
    body.rotation.z += pose.roll;
    age.current += Math.min(delta, 0.05);
  };
}
