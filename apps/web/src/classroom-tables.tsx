import { localTableInk } from "./table-ink-state";
import { useEffect, useMemo, useRef } from "react";
import type { Room } from "@colyseus/sdk";
import * as THREE from "three";
import {
  CLASSROOM_TABLES,
  TABLE_RADIUS as R,
  TABLE_HEIGHT as H,
  tableInkHit,
  tableInkMarks,
  inkTravelTime,
  type PaintStroke,
  type TableInkMark,
} from "@gaya/shared";
import { inkOutlineRadius } from "@gaya/shared";
import type { GameState } from "./game-types";

const SIDE_W = 1024,
  SIDE_H = 256,
  TOP_SIZE = 512;
function makeCloth() {
  const geometry = new THREE.PlaneGeometry(1, 1, 128, 16),
    positions = geometry.attributes.position!;
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < positions.count; i++) {
    const angle = uv.getX(i) * Math.PI * 2,
      t = 1 - uv.getY(i);
    const wave =
      Math.sin(angle * 32) * 0.65 + Math.sin(angle * 49 + 0.4) * 0.35;
    const radius = R + 0.015 + wave * (0.008 + t * 0.065) + t * t * 0.035;
    const y = H + 0.025 - t * (H - 0.28) + t * t * Math.sin(angle * 17) * 0.035;
    positions.setXYZ(i, Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}
function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}
export function ClassroomTables({
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
  const cloth = useMemo(makeCloth, []);
  const surfaces = useMemo(
    () =>
      CLASSROOM_TABLES.map(() => ({
        top: surface(TOP_SIZE, TOP_SIZE),
        side: surface(SIDE_W, SIDE_H),
      })),
    [],
  );
  const options = useRef({ colorA, colorB, canPaint });
  options.current = { colorA, colorB, canPaint };
  useEffect(() => {
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const clear = () => {
      localTableInk.clear();
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
      for (const table of surfaces)
        for (const item of Object.values(table)) {
          item.canvas
            .getContext("2d")!
            .clearRect(0, 0, item.canvas.width, item.canvas.height);
          item.texture.needsUpdate = true;
        }
    };
    const stamp = (mark: TableInkMark, color: string) => {
      const item = surfaces[mark.table]![mark.surface],
        ctx = item.canvas.getContext("2d")!;
      const top = mark.surface === "top";
      const sx = item.canvas.width / (top ? R * 2 : Math.PI * 2 * R),
        sy = item.canvas.height / (top ? R * 2 : H - 0.28);
      const x = (top ? mark.x + R : mark.x) * sx,
        y = (top ? mark.y + R : H + 0.025 - mark.y) * sy;
      // Draw on both sides of the cylinder seam so a splat remains continuous.
      for (const shift of top ? [0] : [-SIDE_W, 0, SIDE_W]) {
        ctx.save();
        ctx.translate(x + shift, y);
        ctx.scale(sx, sy);
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * Math.PI * 2,
            r = mark.radius * inkOutlineRadius(a),
            px = Math.cos(a) * r,
            py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      item.texture.needsUpdate = true;
    };
    const paint = (stroke: PaintStroke, immediate = false) => {
      const marks = tableInkMarks(stroke);
      if (!marks.length) return;
      const color =
        stroke.practiceColor ??
        (stroke.team === "A" ? options.current.colorA : options.current.colorB);
      localTableInk.apply(stroke, color);
      const hit = tableInkHit(stroke);
      const delay = immediate
        ? 0
        : hit
          ? inkTravelTime(
              stroke.pitch ?? 0,
              Math.hypot(hit.point.x - stroke.x, hit.point.z - stroke.z),
              hit.point.y - 1.1,
            ) * 1000
          : 180;
      if (!delay) {
        marks.forEach((mark) => stamp(mark, color));
        return;
      }
      const timer = setTimeout(() => {
        pending.delete(timer);
        marks.forEach((mark) => stamp(mark, color));
      }, delay);
      pending.add(timer);
    };
    const devPaint = (event: Event) => {
      if (options.current.canPaint)
        paint((event as CustomEvent<PaintStroke>).detail);
    };
    const removePaint = room?.onMessage("paint", (stroke: PaintStroke) =>
      paint(stroke),
    );
    const removeSnapshot = room?.onMessage(
      "paint-snapshot",
      (snapshot: { tablePaint?: PaintStroke[] }) => {
        clear();
        snapshot.tablePaint?.forEach((stroke) => paint(stroke, true));
      },
    );
    if (devMode) window.addEventListener("dev-paint", devPaint, true);
    window.addEventListener("dev-reset-paint", clear);
    return () => {
      clear();
      removePaint?.();
      removeSnapshot?.();
      window.removeEventListener("dev-paint", devPaint, true);
      window.removeEventListener("dev-reset-paint", clear);
    };
  }, [surfaces, room, devMode]);
  useEffect(
    () => () => {
      cloth.dispose();
      surfaces.forEach((table) =>
        Object.values(table).forEach((item) => item.texture.dispose()),
      );
    },
    [cloth, surfaces],
  );
  return (
    <group name="classroom-tables">
      {CLASSROOM_TABLES.map((table, index) => (
        <group key={table.id} name={table.id} position={[table.x, 0, table.z]}>
          <mesh position-y={H - 0.08} castShadow receiveShadow>
            <cylinderGeometry args={[R - 0.025, R - 0.025, 0.16, 80]} />
            <meshStandardMaterial color="#e5e6e3" roughness={0.8} />
          </mesh>
          {[0, 1, 2, 3].map((leg) => (
            <mesh
              key={leg}
              position={[
                Math.cos((leg * Math.PI) / 2 + Math.PI / 4) * (R - 0.5),
                (H - 0.16) / 2,
                Math.sin((leg * Math.PI) / 2 + Math.PI / 4) * (R - 0.5),
              ]}
              castShadow
            >
              <cylinderGeometry args={[0.075, 0.075, H - 0.16, 12]} />
              <meshStandardMaterial color="#cdd0cf" roughness={0.7} />
            </mesh>
          ))}
          <mesh
            position-y={H + 0.035}
            rotation-x={-Math.PI / 2}
            castShadow
            receiveShadow
          >
            <circleGeometry args={[R + 0.02, 96]} />
            <meshStandardMaterial
              color="#fafaf8"
              roughness={0.98}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={cloth} castShadow receiveShadow>
            <meshStandardMaterial
              color="#f4f4f1"
              roughness={0.98}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position-y={H + 0.045} rotation-x={-Math.PI / 2} receiveShadow>
            <circleGeometry args={[R + 0.02, 96]} />
            <meshStandardMaterial
              map={surfaces[index]!.top.texture}
              transparent
              depthWrite={false}
              roughness={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={cloth} scale={[1.003, 1, 1.003]} receiveShadow>
            <meshStandardMaterial
              map={surfaces[index]!.side.texture}
              transparent
              depthWrite={false}
              roughness={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
