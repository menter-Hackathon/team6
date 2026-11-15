import { Grid, Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { Room } from "@colyseus/sdk";
import {
  FIELD_HALF_SIZE,
  INPUT_SEND_RATE,
  PLAYER_SPEED,
  DIVE_SPEED,
  DISC_SPEED,
  PAINT_GRID_SIZE,
  isFootprintOwned,
  rasterizePaintStroke,
  type PaintStroke,
  type MoveInput,
} from "@gaya/shared";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GameState } from "./game-types";

const STONE_PROFILE = [
  [0, 0], [0.4, 0], [0.46, 0.012], [0.5, 0.04],
  [0.52, 0.08], [0.52, 0.12], [0.5, 0.16],
  [0.46, 0.188], [0.4, 0.2], [0, 0.2],
].map(([radius, height]) => new THREE.Vector2(radius!, height!));
import {
  rotateYaw,
  toModelRotation,
  toWorldDirection,
} from "./input-direction";

interface GameSceneProps {
  roomRef: MutableRefObject<Room<GameState> | null>;
  playerIds: string[];
  devMode?: boolean;
}

interface ControlState {
  keys: Set<string>;
  yaw: number;
  position: { x: number; z: number };
  sequence: number;
  latestInput: MoveInput;
}

export function GameScene({ roomRef, playerIds, devMode = false }: GameSceneProps) {
  const devOwnPaint = useRef<(x: number, z: number) => boolean>(() => false);
  const controls = useRef<ControlState>({
    keys: new Set(),
    yaw: 0,
    position: { x: 0, z: 0 },
    sequence: 0,
    latestInput: { sequence: 0, x: 0, z: 0, yaw: 0, dive: false },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["KeyQ", "KeyE", "Space"].includes(event.code) && !event.repeat && !(event.target instanceof HTMLInputElement)) {
        if (event.code === "Space") event.preventDefault();
        const kind = event.code === "KeyQ" ? "ring" : event.code === "KeyE" ? "line" : "fan";
        if (devMode) {
          window.dispatchEvent(new CustomEvent("dev-paint", { detail: { revision: 0, ...controls.current.position, yaw: controls.current.yaw, team: "A", kind } }));
        } else {
          roomRef.current?.send("paint", { kind });
        }
      }
      controls.current.keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) =>
      controls.current.keys.delete(event.code);
    const onBlur = () => controls.current.keys.clear();
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement) {
        controls.current.yaw = rotateYaw(controls.current.yaw, event.movementX);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof HTMLCanvasElement &&
        (devMode || roomRef.current?.state.phase === "playing" ||
          roomRef.current?.state.phase === "lobby")
      ) {
        void event.target.requestPointerLock();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("click", onClick);
    };
  }, [devMode, roomRef]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const room = roomRef.current;
      if (!room) return;
      const keys = controls.current.keys;
      const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
      const right = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
      const yaw = controls.current.yaw;
      const direction = toWorldDirection(forward, right, yaw);
      controls.current.sequence += 1;
      const input: MoveInput = {
        sequence: controls.current.sequence,
        x: direction.x,
        z: direction.z,
        yaw,
        dive: keys.has("ShiftLeft") || keys.has("ShiftRight"),
      };
      controls.current.latestInput = input;
      room.send("move", input);
    }, 1000 / INPUT_SEND_RATE);
    return () => window.clearInterval(interval);
  }, [roomRef]);

  const localId = roomRef.current?.sessionId;

  return (
    <>
      <color attach="background" args={["#10131c"]} />
      <fog attach="fog" args={["#10131c", 22, 48]} />
      <ambientLight intensity={0.9} />
      <directionalLight
        castShadow
        intensity={2.4}
        position={[8, 14, 5]}
        shadow-mapSize={[1024, 1024]}
      />
      <Sky sunPosition={[4, 2, 8]} turbidity={6} rayleigh={0.7} />
      <Field room={roomRef.current} devMode={devMode} devOwnPaint={devOwnPaint} />
      {devMode && <DevPlayer controls={controls} ownPaint={devOwnPaint} />}
      {playerIds.map((playerId) => (
        <Player
          key={playerId}
          playerId={playerId}
          local={playerId === localId}
          roomRef={roomRef}
          controls={controls}
          color={roomRef.current?.state.players.get(playerId)?.team === "B" ? "#37d9ff" : "#ff4f8b"}
        />
      ))}
    </>
  );
}

function useDiveAppearance() {
  const body = useRef<THREE.Mesh>(null);
  const face = useRef<THREE.Mesh>(null);
  const disc = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const sink = useRef(0);
  const rippleAge = useRef(1);
  const wasSubmerged = useRef(false);

  const update = (dive: boolean, submerged: boolean, delta: number) => {
    if (submerged !== wasSubmerged.current) {
      rippleAge.current = 0;
      wasSubmerged.current = submerged;
    }
    sink.current = THREE.MathUtils.damp(sink.current, submerged ? -1.7 : 0, 13, delta);
    if (body.current) {
      body.current.position.y = 0.75 + sink.current;
      body.current.visible = !dive || (submerged && sink.current > -1.5);
    }
    if (face.current) {
      face.current.position.y = 1.1 + sink.current;
      face.current.visible = !dive || (submerged && sink.current > -1.5);
    }
    if (disc.current) disc.current.visible = dive && !submerged;
    rippleAge.current += delta;
    if (ripple.current) {
      const progress = Math.min(rippleAge.current / 0.55, 1);
      ripple.current.visible = progress < 1;
      ripple.current.scale.setScalar(0.7 + progress * 1.6);
      (ripple.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - progress);
    }
  };
  return { body, face, disc, ripple, update };
}

function DevPlayer({ controls, ownPaint }: { controls: MutableRefObject<ControlState>; ownPaint: MutableRefObject<(x: number, z: number) => boolean> }) {
  const group = useRef<THREE.Group>(null);
  const appearance = useDiveAppearance();
  const { camera } = useThree();
  useFrame((_, delta) => {
    const object = group.current;
    if (!object) return;
    const keys = controls.current.keys;
    const direction = toWorldDirection(Number(keys.has("KeyW")) - Number(keys.has("KeyS")), Number(keys.has("KeyD")) - Number(keys.has("KeyA")), controls.current.yaw);
    const dive = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const submerged = dive && ownPaint.current(object.position.x, object.position.z);
    const speed = dive ? (submerged ? DIVE_SPEED : DISC_SPEED) : PLAYER_SPEED;
    object.position.x = THREE.MathUtils.clamp(object.position.x + direction.x * speed * delta, -FIELD_HALF_SIZE + 0.5, FIELD_HALF_SIZE - 0.5);
    object.position.z = THREE.MathUtils.clamp(object.position.z + direction.z * speed * delta, -FIELD_HALF_SIZE + 0.5, FIELD_HALF_SIZE - 0.5);
    const nowSubmerged = dive && ownPaint.current(object.position.x, object.position.z);
    appearance.update(dive, nowSubmerged, delta);
    object.rotation.y = toModelRotation(controls.current.yaw);
    controls.current.position = { x: object.position.x, z: object.position.z };
    const yaw = controls.current.yaw;
    camera.position.lerp(new THREE.Vector3(object.position.x + Math.sin(yaw) * 7, 5.2, object.position.z - Math.cos(yaw) * 7), 1 - Math.exp(-delta * 8));
    camera.lookAt(object.position.x, 1.1, object.position.z);
    const readout = document.getElementById("dev-readout");
    if (readout) readout.textContent = `X ${object.position.x.toFixed(1)} / Z ${object.position.z.toFixed(1)} / 向き ${Math.round(yaw * 180 / Math.PI)}°`;
  });
  return <group ref={group}>
    <mesh ref={appearance.body} castShadow position-y={0.75}><capsuleGeometry args={[0.42, 0.7, 8, 16]} /><meshStandardMaterial color="#ff4f8b" /></mesh>
    <mesh ref={appearance.face} position={[0, 1.1, 0.39]}><boxGeometry args={[0.4, 0.18, 0.16]} /><meshStandardMaterial color="white" /></mesh>
    <mesh ref={appearance.disc} visible={false} castShadow position-y={0.03}><latheGeometry args={[STONE_PROFILE, 48]} /><meshStandardMaterial color="#ff4f8b" roughness={0.4} metalness={0.25} /></mesh>
    <mesh ref={appearance.ripple} visible={false} rotation-x={-Math.PI / 2} position-y={0.05}><ringGeometry args={[0.45, 0.57, 40]} /><meshBasicMaterial color="#ff4f8b" transparent opacity={0} depthWrite={false} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={0.025}><ringGeometry args={[0.58, 0.68, 32]} /><meshBasicMaterial color="white" /></mesh>
  </group>;
}

function Field({ room, devMode, devOwnPaint }: { room: Room<GameState> | null; devMode: boolean; devOwnPaint: MutableRefObject<(x: number, z: number) => boolean> }) {
  const canvas = useMemo(() => {
    const element = document.createElement("canvas");
    element.width = element.height = PAINT_GRID_SIZE;
    return element;
  }, []);
  const texture = useMemo(() => {
    const value = new THREE.CanvasTexture(canvas);
    value.colorSpace = THREE.SRGBColorSpace;
    return value;
  }, [canvas]);
  const revision = useRef(0);
  const cells = useMemo(() => new Uint8Array(PAINT_GRID_SIZE ** 2), []);
  useEffect(() => {
    if (!room && !devMode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(PAINT_GRID_SIZE, PAINT_GRID_SIZE);
    if (devMode) devOwnPaint.current = (x, z) => isFootprintOwned(cells, x, z, 1);
    const paint = (stroke: PaintStroke) => {
      if (!devMode && stroke.revision !== revision.current + 1) {
        room?.send("paint-snapshot");
        return;
      }
      if (!devMode) revision.current = stroke.revision;
      const team = stroke.team === "A" ? 1 : 2;
      let minX = PAINT_GRID_SIZE, minY = PAINT_GRID_SIZE, maxX = -1, maxY = -1;
      rasterizePaintStroke(stroke, (x, y) => {
        const index = y * PAINT_GRID_SIZE + x;
        if (cells[index] === team) return;
        cells[index] = team;
        const offset = index * 4;
        image.data[offset] = team === 1 ? 255 : 55;
        image.data[offset + 1] = team === 1 ? 79 : 217;
        image.data[offset + 2] = team === 1 ? 139 : 255;
        image.data[offset + 3] = 255;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      });
      if (maxX >= 0) {
        ctx.putImageData(image, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
        texture.needsUpdate = true;
      }
    };
    const devPaint = (event: Event) => paint((event as CustomEvent<PaintStroke>).detail);
    if (devMode) window.addEventListener("dev-paint", devPaint);
    const removePaint = room?.onMessage("paint", paint);
    const removeSnapshot = room?.onMessage("paint-snapshot", async (snapshot: { revision: number; data: string }) => {
      if (snapshot.revision < revision.current) return;
      const bytes = Uint8Array.from(atob(snapshot.data), (char) => char.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
      const received = new Uint8Array(await new Response(stream).arrayBuffer());
      if (snapshot.revision < revision.current || received.length !== cells.length) return;
      cells.set(received);
      image.data.fill(0);
      for (let i = 0; i < cells.length; i++) {
        const team = cells[i];
        if (!team) continue;
        const offset = i * 4;
        image.data[offset] = team === 1 ? 255 : 55;
        image.data[offset + 1] = team === 1 ? 79 : 217;
        image.data[offset + 2] = team === 1 ? 139 : 255;
        image.data[offset + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      revision.current = snapshot.revision;
      texture.needsUpdate = true;
    });
    room?.send("paint-snapshot");
    return () => { devOwnPaint.current = () => false; removePaint?.(); removeSnapshot?.(); window.removeEventListener("dev-paint", devPaint); };
  }, [room, devMode, canvas, texture, devOwnPaint, cells]);
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FIELD_HALF_SIZE * 2, FIELD_HALF_SIZE * 2]} />
        <meshStandardMaterial color="#272d3d" roughness={0.88} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.018}>
        <planeGeometry args={[FIELD_HALF_SIZE * 2, FIELD_HALF_SIZE * 2]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
      <Grid
        position={[0, 0.012, 0]}
        args={[FIELD_HALF_SIZE * 2, FIELD_HALF_SIZE * 2]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#424b62"
        sectionSize={4}
        sectionThickness={1.2}
        sectionColor="#76809a"
        fadeDistance={36}
        infiniteGrid={false}
      />
      {[
        [0, 1.2, -FIELD_HALF_SIZE],
        [0, 1.2, FIELD_HALF_SIZE],
        [-FIELD_HALF_SIZE, 1.2, 0],
        [FIELD_HALF_SIZE, 1.2, 0],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <boxGeometry
            args={
              index < 2
                ? [FIELD_HALF_SIZE * 2, 2.4, 0.25]
                : [0.25, 2.4, FIELD_HALF_SIZE * 2]
            }
          />
          <meshStandardMaterial color="#1a1f2c" transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

interface PlayerProps {
  playerId: string;
  local: boolean;
  color: string;
  roomRef: MutableRefObject<Room<GameState> | null>;
  controls: MutableRefObject<ControlState>;
}

function Player({ playerId, local, color, roomRef, controls }: PlayerProps) {
  const group = useRef<THREE.Group>(null);
  const predicted = useRef(new THREE.Vector3());
  const appearance = useDiveAppearance();
  const initialized = useRef(false);
  const { camera } = useThree();
  const cameraOffset = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const player = roomRef.current?.state.players.get(playerId);
    const object = group.current;
    if (!player || !object) return;
    const diving = local ? (controls.current.keys.has("ShiftLeft") || controls.current.keys.has("ShiftRight")) : player.dive;
    appearance.update(diving, diving && player.submerged, delta);

    if (!initialized.current) {
      predicted.current.set(player.x, 0, player.z);
      initialized.current = true;
    }

    if (local) {
      const input = controls.current.latestInput;
      const length = Math.hypot(input.x, input.z);
      const scale = length > 1 ? 1 / length : 1;
      const speed = input.dive ? (player.submerged ? DIVE_SPEED : DISC_SPEED) : PLAYER_SPEED;
      predicted.current.x += input.x * scale * speed * delta;
      predicted.current.z += input.z * scale * speed * delta;
      const error = predicted.current.distanceTo(
        cameraTarget.set(player.x, 0, player.z),
      );
      if (error > 2.5) predicted.current.copy(cameraTarget);
      else predicted.current.lerp(cameraTarget, 1 - Math.exp(-delta * 4));
      object.position.copy(predicted.current);
      object.rotation.y = toModelRotation(controls.current.yaw);

      const yaw = controls.current.yaw;
      cameraOffset.set(Math.sin(yaw) * 7, 5.2, -Math.cos(yaw) * 7);
      camera.position.lerp(
        cameraTarget.copy(object.position).add(cameraOffset),
        1 - Math.exp(-delta * 8),
      );
      camera.lookAt(object.position.x, 1.1, object.position.z);
    } else {
      cameraTarget.set(player.x, 0, player.z);
      object.position.lerp(cameraTarget, 1 - Math.exp(-delta * 10));
      object.rotation.y = THREE.MathUtils.lerp(
        object.rotation.y,
        toModelRotation(player.yaw),
        0.18,
      );
    }
  });

  return (
    <group ref={group}>
      <mesh ref={appearance.body} castShadow position-y={0.75}>
        <capsuleGeometry args={[0.42, 0.7, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh ref={appearance.face} castShadow position={[0, 1.1, 0.39]}>
        <boxGeometry args={[0.4, 0.18, 0.16]} />
        <meshStandardMaterial
          color="#f5f7ff"
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh ref={appearance.disc} visible={false} castShadow position-y={0.03}>
        <latheGeometry args={[STONE_PROFILE, 48]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.35} transparent opacity={local ? 0.8 : 1} />
      </mesh>
      <mesh ref={appearance.ripple} visible={false} rotation-x={-Math.PI / 2} position-y={0.05}>
        <ringGeometry args={[0.45, 0.57, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
      {local && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.025}>
          <ringGeometry args={[0.58, 0.68, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}
