import { useEffect, useMemo, useRef } from "react";
import type { Room } from "@colyseus/sdk";
import * as THREE from "three";
import {
  FIELD_HALF_WIDTH as W,
  FIELD_HALF_DEPTH as D,
  CLASSROOM_HEIGHT as H,
  wallInkMarks,
  type PaintStroke,
  inkOutlineRadius,
} from "@gaya/shared";
import type { GameState } from "./game-types";
export function ClassroomWallInk({
  room,
  devMode,
  colorA,
  colorB,
  canPaint,
}: {
  room: Room<GameState> | null;
  devMode: boolean;
  colorA: string;
  colorB: string;
  canPaint: boolean;
}) {
  const options = useRef({ colorA, colorB, canPaint });
  options.current = { colorA, colorB, canPaint };
  const surfaces = useMemo(
    () =>
      [W * 2, W * 2, D * 2, D * 2].map((width) => {
        const canvas = document.createElement("canvas");
        canvas.width = 2048;
        canvas.height = 256;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return { canvas, texture, width };
      }),
    [],
  );
  useEffect(() => {
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const clear = () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
      surfaces.forEach((item) => {
        item.canvas.getContext("2d")!.clearRect(0, 0, 2048, 256);
        item.texture.needsUpdate = true;
      });
    };
    const paint = (stroke: PaintStroke, immediate = false) => {
      const marks = wallInkMarks(stroke);
      if (!marks.length) return;
      const color =
        stroke.practiceColor ??
        (stroke.team === "A" ? options.current.colorA : options.current.colorB);
      const draw = () => {
        for (const mark of marks) {
          const item = surfaces[mark.wall]!,
            ctx = item.canvas.getContext("2d")!;
          ctx.save();
          ctx.translate(
            (mark.x / item.width + 0.5) * 2048,
            (1 - mark.y / H) * 256,
          );
          ctx.scale(2048 / item.width, 256 / H);
          ctx.fillStyle = color;
          ctx.beginPath();
          for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2,
              r = mark.radius * inkOutlineRadius(a);
            if (!i) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          item.texture.needsUpdate = true;
        }
      };
      if (immediate) draw();
      else {
        const timer = setTimeout(() => {
          pending.delete(timer);
          draw();
        }, 160);
        pending.add(timer);
      }
    };
    const devPaint = (event: Event) => {
      if (options.current.canPaint)
        paint((event as CustomEvent<PaintStroke>).detail);
    };
    const remove = room?.onMessage("paint", (stroke: PaintStroke) =>
      paint(stroke),
    );
    const snapshot = room?.onMessage(
      "paint-snapshot",
      (value: { wallPaint?: PaintStroke[] }) => {
        clear();
        value.wallPaint?.forEach((stroke) => paint(stroke, true));
      },
    );
    if (devMode) window.addEventListener("dev-paint", devPaint, true);
    window.addEventListener("dev-reset-paint", clear);
    return () => {
      clear();
      remove?.();
      snapshot?.();
      window.removeEventListener("dev-paint", devPaint, true);
      window.removeEventListener("dev-reset-paint", clear);
    };
  }, [surfaces, room, devMode]);
  useEffect(
    () => () => surfaces.forEach((item) => item.texture.dispose()),
    [surfaces],
  );
  return (
    <group name="classroom-wall-ink">
      {[
        { position: [0, H / 2, D - 0.21], yaw: Math.PI },
        { position: [0, H / 2, -D + 0.21], yaw: 0 },
        { position: [-W + 0.21, H / 2, 0], yaw: Math.PI / 2 },
        { position: [W - 0.21, H / 2, 0], yaw: -Math.PI / 2 },
      ].map((wall, index) => (
        <mesh
          key={index}
          position={wall.position as [number, number, number]}
          rotation-y={wall.yaw}
        >
          <planeGeometry args={[surfaces[index]!.width, H]} />
          <meshStandardMaterial
            map={surfaces[index]!.texture}
            transparent
            depthWrite={false}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}
