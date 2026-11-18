import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { inkOutlineRadius, paintDisks, type PaintStroke } from "@gaya/shared";
import {
  sweptInkContact,
  wallContours,
  topContours,
  adjacentFaceStamps,
  type WallContour,
} from "./dev-obstacle-paint";
import { INK_SCALE } from "@gaya/shared";
import { InkEffects } from "./ink-effects";
import {
  BOX_WIDTH as W,
  BOX_DEPTH as D,
  BOX_HEIGHT as H,
  DEV_OBSTACLES,
  obstacleInk,
} from "./dev-obstacle-layout";

const faces = [
  { size: [W, H], position: [0, H / 2, D / 2 + 0.004], rotation: [0, 0, 0] },
  {
    size: [W, H],
    position: [0, H / 2, -D / 2 - 0.004],
    rotation: [0, Math.PI, 0],
  },
  {
    size: [D, H],
    position: [W / 2 + 0.004, H / 2, 0],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    size: [D, H],
    position: [-W / 2 - 0.004, H / 2, 0],
    rotation: [0, -Math.PI / 2, 0],
  },
  { size: [W, D], position: [0, H + 0.004, 0], rotation: [-Math.PI / 2, 0, 0] },
] as const;
function makeSurfaces() {
  return DEV_OBSTACLES.map(() =>
    faces.map(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return { canvas, texture };
    }),
  );
}
export function DevObstacles() {
  const surfaces = useMemo(makeSurfaces, []);
  const effects = useMemo(() => new InkEffects(), []);
  const pending = useMemo(
    () =>
      [] as {
        at: number;
        box: number;
        face: number;
        point: THREE.Vector3;
        color: string;
        radius: number;
      }[],
    [],
  );
  const pendingContours = useMemo(
    () => [] as { at: number; color: string; contour: WallContour }[],
    [],
  );
  const stamp = (
    index: number,
    face: number,
    point: THREE.Vector3,
    color: string,
    radius: number,
  ) => {
    const box = DEV_OBSTACLES[index]!,
      surface = surfaces[index]![face]!,
      dimensions = faces[face]!.size;
    const local = point.clone().sub(new THREE.Vector3(box.x, 0, box.z));
    const u =
      face === 0
        ? local.x
        : face === 1
          ? -local.x
          : face === 2
            ? -local.z
            : face === 3
              ? local.z
              : local.x;
    const v = face === 4 ? -local.z : local.y - H / 2;
    const ctx = surface.canvas.getContext("2d")!;
    ctx.save();
    ctx.translate(
      (u / dimensions[0] + 0.5) * 256,
      (0.5 - v / dimensions[1]) * 256,
    );
    ctx.scale(256 / dimensions[0], 256 / dimensions[1]);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2,
        r = radius * inkOutlineRadius(a);
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    surface.texture.needsUpdate = true;
  };
  useFrame((_, delta) => {
    effects.update(delta);
    for (let i = pendingContours.length - 1; i >= 0; i--) {
      const entry = pendingContours[i]!;
      if (performance.now() < entry.at) continue;
      const surface = surfaces[entry.contour.box]![entry.contour.face]!,
        size = faces[entry.contour.face]!.size;
      const ctx = surface.canvas.getContext("2d")!;
      ctx.fillStyle = entry.color;
      ctx.beginPath();
      entry.contour.points.forEach((point, index) => {
        const x = (point.u / size[0] + 0.5) * 256,
          y = (1 - point.height / size[1]) * 256;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      surface.texture.needsUpdate = true;
      pendingContours.splice(i, 1);
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      const hit = pending[i]!;
      if (performance.now() < hit.at) continue;
      stamp(hit.box, hit.face, hit.point, hit.color, hit.radius);
      pending.splice(i, 1);
    }
  });
  useEffect(() => {
    obstacleInk.sample = (box, face, u, v, color) => {
      const surface = surfaces[box]?.[face];
      if (!surface) return false;
      const dimensions = faces[face]!.size;
      const x = Math.floor((u / dimensions[0] + 0.5) * 256),
        y = Math.floor((0.5 - v / dimensions[1]) * 256);
      if (x < 0 || x >= 256 || y < 0 || y >= 256) return false;
      const pixel = surface.canvas
        .getContext("2d")!
        .getImageData(x, y, 1, 1).data;
      const expected = [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
      ];
      return (
        pixel[3]! > 180 &&
        expected.every((value, i) => Math.abs(value - pixel[i]!) < 8)
      );
    };
    const paint = (event: Event) => {
      const stroke = (event as CustomEvent<PaintStroke & { height?: number }>)
        .detail;
      const color =
        stroke.practiceColor ?? (stroke.team === "A" ? "#ff4f8b" : "#37d9ff");
      const disks = paintDisks(stroke);
      if (stroke.kind !== "ink" && Math.abs((stroke.height ?? 0) - H) < 0.1) {
        const contacts = topContours(disks, stroke.height ?? 0);
        if (contacts.length) {
          event.stopImmediatePropagation();
          const delay = stroke.kind === "footprint" ? 0 : 0.22;
          if (stroke.kind !== "footprint") {
            effects.setColors(color, color);
            effects.emit(stroke, undefined, H);
          }
          for (const contour of contacts)
            pendingContours.push({
              at: performance.now() + delay * 1000,
              color,
              contour,
            });
          return;
        }
      }
      const queueEdges = (delay: number) => {
        for (const contour of wallContours(disks, stroke))
          pendingContours.push({
            at: performance.now() + delay * 1000,
            color,
            contour,
          });
      };
      if (stroke.kind !== "ink") {
        queueEdges(0.22);
        return;
      }
      const destination = disks[0]!;
      const origin = new THREE.Vector3(
        stroke.x - Math.sin(stroke.yaw) * 0.32,
        1.1 + (stroke.height ?? 0),
        stroke.z + Math.cos(stroke.yaw) * 0.32,
      );
      const target = new THREE.Vector3(destination.x, 0.035, destination.z);
      const duration = THREE.MathUtils.clamp(
        origin.distanceTo(target) / 32,
        0.12,
        0.52,
      );
      let last = origin.clone();
      for (let step = 1; step <= 24; step++) {
        const t = step / 24,
          next = origin.clone().lerp(target, t);
        next.y += 0.5 * 16 * duration * duration * t * (1 - t);
        const direction = next.clone().sub(last),
          length = direction.length();
        if (!length) continue;
        let nearest: {
          box: number;
          face: number;
          point: THREE.Vector3;
          distance: number;
        } | null = null;
        DEV_OBSTACLES.forEach((box, index) => {
          const bounds = new THREE.Box3(
            new THREE.Vector3(box.x - W / 2, 0, box.z - D / 2),
            new THREE.Vector3(box.x + W / 2, H, box.z + D / 2),
          );
          const point = sweptInkContact(last, next, 0.22 * INK_SCALE, bounds);
          if (!point) return;
          const distance = bounds
            .clone()
            .expandByScalar(0.22 * INK_SCALE)
            .clampPoint(last, new THREE.Vector3())
            .distanceTo(last);
          if (
            distance > length + 0.001 ||
            (nearest && distance >= nearest.distance)
          )
            return;
          const distances = [
            Math.abs(point.z - bounds.max.z),
            Math.abs(point.z - bounds.min.z),
            Math.abs(point.x - bounds.max.x),
            Math.abs(point.x - bounds.min.x),
            Math.abs(point.y - H),
          ];
          nearest = {
            box: index,
            face: distances.indexOf(Math.min(...distances)),
            point,
            distance,
          };
        });
        const hit = nearest as {
          box: number;
          face: number;
          point: THREE.Vector3;
          distance: number;
        } | null;
        if (hit) {
          event.stopImmediatePropagation();
          effects.setColors(color, color);
          const flight = effects.emit(stroke, hit.point);
          for (const contact of adjacentFaceStamps(hit.box, hit.point, 1.05))
            pending.push({
              ...contact,
              color,
              at: performance.now() + flight * 1000,
            });
          return;
        }
        last = next;
      }
      queueEdges(duration + 0.22);
    };
    window.addEventListener("dev-paint", paint, true);
    return () => {
      window.removeEventListener("dev-paint", paint, true);
      obstacleInk.sample = () => false;
      effects.dispose();
      surfaces.flat().forEach((surface) => surface.texture.dispose());
    };
  }, [effects, surfaces, pending, pendingContours]);
  return (
    <group name="dev-obstacle-layout">
      <primitive object={effects.group} />
      {DEV_OBSTACLES.map((box, index) => (
        <group key={box.id} position={[box.x, 0, box.z]}>
          <mesh position-y={H / 2} castShadow receiveShadow>
            <boxGeometry args={[W, H, D]} />
            <meshStandardMaterial color="#a3b4ad" roughness={0.72} />
          </mesh>
          {faces.map((face, f) => (
            <mesh
              key={f}
              position={[...face.position]}
              rotation={[...face.rotation]}
              receiveShadow
            >
              <planeGeometry args={[...face.size]} />
              <meshStandardMaterial
                map={surfaces[index]![f]!.texture}
                transparent
                depthWrite={false}
                roughness={0.13}
                metalness={0.04}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
