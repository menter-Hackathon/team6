import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CLASSROOM_TABLES, TABLE_HEIGHT, type PaintStroke } from "@gaya/shared";

/** A URL-only staging view for screenshots, independent of rooms and live play. */
export function StageCapture({ colors }: { colors: 0 | 2 | 4 }) {
  const { camera } = useThree();
  useEffect(() => {
    if ("far" in camera) {
      camera.far = 200;
      if ("fov" in camera) camera.fov = 46;
      camera.updateProjectionMatrix();
    }
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("dev-reset-paint"));
      if (colors === 0) return;
      const palette = ["#ff4f8b", "#37d9ff", "#b8ff39", "#ff9736"];
      const colorAt = (x: number, z: number) =>
        palette[
          colors === 2
            ? x + z * 0.2 < 0
              ? 0
              : 1
            : (x < 0 ? 0 : 1) + (z > 0 ? 2 : 0)
        ]!;
      const paint = (
        stroke: Omit<PaintStroke, "revision" | "team" | "practiceColor">,
      ) =>
        window.dispatchEvent(
          new CustomEvent("dev-paint", {
            detail: {
              ...stroke,
              revision: 0,
              team: "A",
              practiceColor: colorAt(stroke.x, stroke.z),
            },
          }),
        );
      for (const z of [-30, -17, -4, 9, 22, 33])
        for (const x of [-14, -4, 6, 15]) {
          if ((z === -4 && x === 6) || (z === 22 && x === -4)) continue;
          for (let i = 0; i < 6; i++) {
            const angle = i * 2.399 + (x + z) * 0.1,
              reach = i === 0 ? 0 : 1.8 + 0.4 * Math.sin(x * i + z);
            paint({
              kind: "ink",
              x: x + Math.cos(angle) * reach,
              z: z - 4.45 + Math.sin(angle) * reach,
              yaw: 0,
              scale: 1.5,
              inkVariant: i % 4,
            });
          }
        }
      for (const table of CLASSROOM_TABLES) {
        paint({
          kind: "footprint",
          height: TABLE_HEIGHT,
          x: table.x - 0.4,
          z: table.z - 0.3,
          fromX: table.x - 1.2,
          fromZ: table.z - 1,
          yaw: 0,
        });
      }
      for (const x of [-12, 12])
        for (const z of [-39, 39])
          paint({ kind: "ink", x, z, yaw: z > 0 ? 0 : Math.PI, pitch: 0.15 });
    }, 400);
    return () => clearTimeout(timer);
  }, [camera, colors]);
  useFrame(() => {
    const fov = colors === 0 ? 64 : 46;
    if ("fov" in camera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (colors === 0) {
      camera.position.set(16, 3.3, -31);
      camera.lookAt(-4, 3.8, 7);
    } else {
      camera.position.set(42, 50, -60);
      camera.lookAt(0, 0, -7);
    }
  }, 1);
  // A positive priority owns rendering; draw after the staged camera has been placed.
  useFrame(({ gl, scene, camera }) => gl.render(scene, camera), 2);
  return null;
}
