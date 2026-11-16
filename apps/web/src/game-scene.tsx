import { Grid } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { Room } from "@colyseus/sdk";
import {
  FIELD_HALF_SIZE,
  advanceSpecial,
  INPUT_SEND_RATE,
  PLAYER_SPEED,
  PLAYER_SIZE,
  DIVE_SPEED,
  DISC_SPEED,
  INK_SHOT_INTERVAL,
  updateDiveState,
  type DiveState,
  PAINT_GRID_SIZE,
  isFootprintOwned,
  rasterizePaintStroke,
  type PaintStroke,
  type MoveInput,
  type SpecialShape,
} from "@gaya/shared";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bleedSpecialPaint } from "./paint-bleed";
import { useSpecialAppearance } from "./special-appearance";
import { InkEffects, INK_SETTLE_SECONDS } from "./ink-effects";
import type { GameState } from "./game-types";

import {
  rotateYaw,
  toModelRotation,
  toWorldDirection,
} from "./input-direction";

interface GameSceneProps {
  roomRef: MutableRefObject<Room<GameState> | null>;
  playerIds: string[];
  devMode?: boolean;
  specialShape: SpecialShape;
}

interface ControlState {
  keys: Set<string>;
  firing: boolean;
  specialTime: number;
  specialShape: SpecialShape;
  yaw: number;
  position: { x: number; z: number };
  sequence: number;
  latestInput: MoveInput;
}

export function GameScene({
  roomRef,
  playerIds,
  devMode = false,
  specialShape,
}: GameSceneProps) {
  const devOwnPaint = useRef<(x: number, z: number) => boolean>(() => false);
  const controls = useRef<ControlState>({
    keys: new Set(),
    firing: false,
    specialTime: -1,
    specialShape: "star",
    yaw: 0,
    position: { x: 0, z: 0 },
    sequence: 0,
    latestInput: { sequence: 0, x: 0, z: 0, yaw: 0, dive: false },
  });

  useEffect(() => {
    const activateSpecial = () => {
      if (devMode) {
        if (controls.current.specialTime < 0) {
          controls.current.specialShape = specialShape;
          controls.current.specialTime = 0;
          controls.current.firing = false;
        }
      } else if (roomRef.current?.state.phase === "playing")
        roomRef.current.send("special", { shape: specialShape });
    };
    window.addEventListener("activate-special", activateSpecial);
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
      )
        return;
      if (event.code === "KeyF" && !event.repeat) {
        event.preventDefault();
        activateSpecial();
        return;
      }
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          event.code,
        )
      )
        event.preventDefault();
      if (
        ["KeyQ", "KeyE", "Space"].includes(event.code) &&
        !event.repeat &&
        !(event.target instanceof HTMLInputElement)
      ) {
        if (event.code === "Space") event.preventDefault();
        const kind =
          event.code === "KeyQ"
            ? "ring"
            : event.code === "KeyE"
              ? "line"
              : "fan";
        if (
          controls.current.keys.has("ShiftLeft") ||
          controls.current.keys.has("ShiftRight")
        )
          return;
        if (devMode && controls.current.specialTime >= 0) return;
        if (devMode) {
          window.dispatchEvent(
            new CustomEvent("dev-paint", {
              detail: {
                revision: 0,
                ...controls.current.position,
                yaw: controls.current.yaw,
                team: "A",
                kind,
              },
            }),
          );
        } else {
          roomRef.current?.send("paint", { kind });
        }
      }
      controls.current.keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) =>
      controls.current.keys.delete(event.code);
    const onBlur = () => {
      controls.current.keys.clear();
      controls.current.firing = false;
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0 && event.target instanceof HTMLCanvasElement)
        controls.current.firing = true;
    };
    const onMouseUp = () => {
      controls.current.firing = false;
    };
    const onLockChange = () => {
      if (!document.pointerLockElement) onBlur();
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement || controls.current.firing) {
        controls.current.yaw = rotateYaw(controls.current.yaw, event.movementX);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof HTMLCanvasElement &&
        (devMode ||
          roomRef.current?.state.phase === "playing" ||
          roomRef.current?.state.phase === "lobby")
      ) {
        void event.target.requestPointerLock().catch(() => {
          /* Drag-to-aim remains available if pointer lock is unavailable. */
        });
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerlockchange", onLockChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("activate-special", activateSpecial);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("click", onClick);
    };
  }, [devMode, roomRef, specialShape]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const room = roomRef.current;
      if (!room) return;
      const keys = controls.current.keys;
      const forward =
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown"));
      const right =
        Number(keys.has("KeyD") || keys.has("ArrowRight")) -
        Number(keys.has("KeyA") || keys.has("ArrowLeft"));
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

  const shotClock = useRef(0);
  useFrame((_, delta) => {
    shotClock.current = Math.max(0, shotClock.current - delta);
    const control = controls.current;
    const networkPlayer = roomRef.current?.state.players.get(
      roomRef.current.sessionId,
    );
    const specialActive =
      (devMode ? control.specialTime : (networkPlayer?.specialTime ?? -1)) >= 0;
    const button = document.getElementById(
      "special-button",
    ) as HTMLButtonElement | null;
    const picker = document.getElementById(
      "special-shape",
    ) as HTMLSelectElement | null;
    if (picker) picker.disabled = specialActive;
    if (button) {
      button.disabled =
        specialActive ||
        (!devMode && roomRef.current?.state.phase !== "playing");
      button.textContent = specialActive
        ? "回転ジャンプ中…"
        : `F  必殺技 · ${specialShape === "ink" ? "● インク" : specialShape === "heart" ? "♥ ハート" : "★ スター"}スラム`;
    }
    if (
      specialActive ||
      !control.firing ||
      control.keys.has("ShiftLeft") ||
      control.keys.has("ShiftRight") ||
      shotClock.current > 0
    )
      return;
    shotClock.current = INK_SHOT_INTERVAL;
    if (devMode)
      window.dispatchEvent(
        new CustomEvent("dev-paint", {
          detail: {
            revision: 0,
            ...control.position,
            yaw: control.yaw,
            team: "A",
            kind: "ink",
          } satisfies PaintStroke,
        }),
      );
    else if (roomRef.current?.state.phase === "playing")
      roomRef.current.send("paint", { kind: "ink" });
  });

  const localId = roomRef.current?.sessionId;

  return (
    <>
      <color attach="background" args={["#ebece5"]} />
      <fog attach="fog" args={["#ebece5", 24, 55]} />
      <hemisphereLight args={["#ffffff", "#8e9c86", 2.7]} />
      <directionalLight
        castShadow
        intensity={3}
        position={[8, 14, 5]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-normalBias={0.03}
      />

      <Field
        room={roomRef.current}
        devMode={devMode}
        devOwnPaint={devOwnPaint}
      />
      {devMode && <DevPlayer controls={controls} ownPaint={devOwnPaint} />}
      {playerIds.map((playerId) => (
        <Player
          key={playerId}
          playerId={playerId}
          local={playerId === localId}
          roomRef={roomRef}
          controls={controls}
          color={
            roomRef.current?.state.players.get(playerId)?.team === "B"
              ? "#37d9ff"
              : "#ff4f8b"
          }
        />
      ))}
    </>
  );
}

function useDiveAppearance() {
  const body = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const sink = useRef(0);
  const rippleAge = useRef(1);
  const wasSubmerged = useRef(false);

  const update = (dive: boolean, submerged: boolean, delta: number) => {
    if (submerged !== wasSubmerged.current) {
      rippleAge.current = 0;
      wasSubmerged.current = submerged;
    }
    sink.current = THREE.MathUtils.damp(
      sink.current,
      submerged ? -1.1 : 0,
      submerged || !dive ? 12 : 2.6,
      delta,
    );
    if (body.current) {
      body.current.position.y = 0.5 + sink.current;
      body.current.visible = sink.current > -1;
    }
    rippleAge.current += delta;
    if (ripple.current) {
      const progress = Math.min(rippleAge.current / 0.55, 1);
      ripple.current.visible = progress < 1;
      ripple.current.scale.setScalar(0.7 + progress * 1.6);
      (ripple.current.material as THREE.MeshBasicMaterial).opacity =
        0.8 * (1 - progress);
    }
  };
  return { body, ripple, update };
}

function DevPlayer({
  controls,
  ownPaint,
}: {
  controls: MutableRefObject<ControlState>;
  ownPaint: MutableRefObject<(x: number, z: number) => boolean>;
}) {
  const group = useRef<THREE.Group>(null);
  const appearance = useDiveAppearance();
  const specialAppearance = useSpecialAppearance();
  const { camera } = useThree();
  const diveState = useRef<DiveState>({
    submerged: false,
    gapSeconds: 0,
    team: 1,
  });
  useFrame((_, delta) => {
    const object = group.current;
    if (!object) return;
    const special = advanceSpecial(
      controls.current.specialTime,
      Math.min(delta, 0.1),
    );
    controls.current.specialTime = special.time;
    const specialActive = special.time >= 0 || special.landed;
    if (special.landed)
      window.dispatchEvent(
        new CustomEvent("dev-paint", {
          detail: {
            revision: 0,
            x: object.position.x,
            z: object.position.z,
            yaw: controls.current.yaw,
            team: "A",
            kind: "slam",
            specialShape: controls.current.specialShape,
          } satisfies PaintStroke,
        }),
      );
    const keys = controls.current.keys;
    const direction = toWorldDirection(
      Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown")),
      Number(keys.has("KeyD") || keys.has("ArrowRight")) -
        Number(keys.has("KeyA") || keys.has("ArrowLeft")),
      controls.current.yaw,
    );
    if (specialActive) {
      direction.x = 0;
      direction.z = 0;
    }
    const length = Math.hypot(direction.x, direction.z);
    if (length > 1) {
      direction.x /= length;
      direction.z /= length;
    }
    const dive =
      !specialActive && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    const before = updateDiveState(
      diveState.current,
      dive,
      ownPaint.current(object.position.x, object.position.z),
      0,
      1,
    );
    const submerged = before.submerged;
    const oldX = object.position.x,
      oldZ = object.position.z;
    const speed = dive ? (submerged ? DIVE_SPEED : DISC_SPEED) : PLAYER_SPEED;
    object.position.x = THREE.MathUtils.clamp(
      object.position.x + direction.x * speed * delta,
      -FIELD_HALF_SIZE + 0.5,
      FIELD_HALF_SIZE - 0.5,
    );
    object.position.z = THREE.MathUtils.clamp(
      object.position.z + direction.z * speed * delta,
      -FIELD_HALF_SIZE + 0.5,
      FIELD_HALF_SIZE - 0.5,
    );
    diveState.current = updateDiveState(
      before,
      dive,
      ownPaint.current(object.position.x, object.position.z),
      Math.min(delta, 0.1),
      1,
    );
    const nowSubmerged = diveState.current.submerged;
    if (
      !dive &&
      Math.hypot(object.position.x - oldX, object.position.z - oldZ) > 0.001
    ) {
      window.dispatchEvent(
        new CustomEvent("dev-paint", {
          detail: {
            revision: 0,
            fromX: oldX,
            fromZ: oldZ,
            x: object.position.x,
            z: object.position.z,
            yaw: controls.current.yaw,
            team: "A",
            kind: "footprint",
          } satisfies PaintStroke,
        }),
      );
    }
    appearance.update(dive, nowSubmerged, delta);
    specialAppearance(
      appearance.body.current,
      controls.current.specialTime,
      delta,
    );
    object.rotation.y = toModelRotation(controls.current.yaw);
    controls.current.position = { x: object.position.x, z: object.position.z };
    const yaw = controls.current.yaw;
    camera.position.lerp(
      new THREE.Vector3(
        object.position.x + Math.sin(yaw) * 6,
        3.7,
        object.position.z - Math.cos(yaw) * 6,
      ),
      1 - Math.exp(-delta * 8),
    );
    camera.lookAt(object.position.x, 1.1, object.position.z);
    const readout = document.getElementById("dev-readout");
    if (readout)
      readout.textContent = `状態 ${nowSubmerged ? "潜航 ×1.5" : "通常"} / X ${object.position.x.toFixed(1)} / Z ${object.position.z.toFixed(1)} / 向き ${Math.round((yaw * 180) / Math.PI)}°`;
  });
  return (
    <group ref={group}>
      <mesh ref={appearance.body} castShadow receiveShadow position-y={0.5}>
        <boxGeometry args={[PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE]} />
        <meshStandardMaterial color="#ff4f8b" />
      </mesh>
      <mesh
        ref={appearance.ripple}
        visible={false}
        rotation-x={-Math.PI / 2}
        position-y={0.05}
      >
        <ringGeometry args={[0.45, 0.57, 40]} />
        <meshBasicMaterial
          color="#ff4f8b"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.025}>
        <ringGeometry args={[0.58, 0.68, 32]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
}

function Field({
  room,
  devMode,
  devOwnPaint,
}: {
  room: Room<GameState> | null;
  devMode: boolean;
  devOwnPaint: MutableRefObject<(x: number, z: number) => boolean>;
}) {
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
  const effects = useMemo(() => new InkEffects(), []);
  const flushPaint = useRef<() => void>(() => {});
  useFrame((_, delta) => {
    effects.update(delta);
    flushPaint.current();
  });
  useEffect(
    () => () => {
      effects.dispose();
      texture.dispose();
    },
    [effects, texture],
  );
  const cells = useMemo(() => new Uint8Array(PAINT_GRID_SIZE ** 2), []);
  useEffect(() => {
    if (!room && !devMode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    effects.clear();
    cells.fill(0);
    revision.current = 0;
    ctx.clearRect(0, 0, PAINT_GRID_SIZE, PAINT_GRID_SIZE);
    texture.needsUpdate = true;
    const image = ctx.createImageData(PAINT_GRID_SIZE, PAINT_GRID_SIZE);
    if (devMode)
      devOwnPaint.current = (x, z) => isFootprintOwned(cells, x, z, 1);
    let disposed = false;
    let syncing = !devMode;
    const pending = new Map<number, PaintStroke>();
    const displayQueue: { stroke: PaintStroke; at: number }[] = [];
    flushPaint.current = () => {
      let minX = PAINT_GRID_SIZE,
        minY = PAINT_GRID_SIZE,
        maxX = -1,
        maxY = -1;
      while (displayQueue.length && displayQueue[0]!.at <= performance.now()) {
        const { stroke } = displayQueue.shift()!;
        const team = stroke.team === "A" ? 1 : 2;
        if (stroke.kind === "slam") {
          const bleed = bleedSpecialPaint(stroke, image);
          if (bleed) {
            minX = Math.min(minX, bleed.left);
            minY = Math.min(minY, bleed.top);
            maxX = Math.max(maxX, bleed.right);
            maxY = Math.max(maxY, bleed.bottom);
          }
        }
        rasterizePaintStroke(stroke, (x, y) => {
          const offset = (y * PAINT_GRID_SIZE + x) * 4;
          image.data[offset] = team === 1 ? 255 : 55;
          image.data[offset + 1] = team === 1 ? 79 : 217;
          image.data[offset + 2] = team === 1 ? 139 : 255;
          image.data[offset + 3] = 255;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        });
      }
      if (maxX >= 0) {
        ctx.putImageData(
          image,
          0,
          0,
          minX,
          minY,
          maxX - minX + 1,
          maxY - minY + 1,
        );
        texture.needsUpdate = true;
      }
    };
    const paint = (stroke: PaintStroke) => {
      if (disposed) return;
      if (!devMode && stroke.revision <= revision.current) return;
      if (!devMode && syncing) {
        pending.set(stroke.revision, stroke);
        return;
      }
      if (!devMode && stroke.revision !== revision.current + 1) {
        syncing = true;
        pending.set(stroke.revision, stroke);
        room?.send("paint-snapshot");
        return;
      }
      if (!devMode) revision.current = stroke.revision;
      const flightSeconds = effects.emit(stroke);
      const team = stroke.team === "A" ? 1 : 2;
      rasterizePaintStroke(stroke, (x, y) => {
        cells[y * PAINT_GRID_SIZE + x] = team;
      });
      // Bake only after the airborne drop lands and its transient splat has expanded.
      displayQueue.push({
        stroke,
        at: performance.now() + (flightSeconds + INK_SETTLE_SECONDS) * 1000,
      });
    };
    const devPaint = (event: Event) =>
      paint((event as CustomEvent<PaintStroke>).detail);
    if (devMode) window.addEventListener("dev-paint", devPaint);
    const removePaint = room?.onMessage("paint", paint);
    const removeSnapshot = room?.onMessage(
      "paint-snapshot",
      async (snapshot: { revision: number; data: string }) => {
        if (snapshot.revision < revision.current) return;
        const bytes = Uint8Array.from(atob(snapshot.data), (char) =>
          char.charCodeAt(0),
        );
        const stream = new Blob([bytes])
          .stream()
          .pipeThrough(new DecompressionStream("deflate"));
        const received = new Uint8Array(
          await new Response(stream).arrayBuffer(),
        );
        if (
          disposed ||
          snapshot.revision < revision.current ||
          received.length !== cells.length
        )
          return;
        displayQueue.length = 0;
        effects.clear();
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
        syncing = false;
        const queued = [...pending.values()].sort(
          (a, b) => a.revision - b.revision,
        );
        pending.clear();
        for (const stroke of queued) paint(stroke);
      },
    );
    room?.send("paint-snapshot");
    return () => {
      disposed = true;
      pending.clear();
      displayQueue.length = 0;
      flushPaint.current = () => {};
      devOwnPaint.current = () => false;
      removePaint?.();
      removeSnapshot?.();
      window.removeEventListener("dev-paint", devPaint);
    };
  }, [room, devMode, canvas, texture, devOwnPaint, cells, effects]);
  return (
    <group>
      <primitive object={effects.group} />
      <mesh receiveShadow rotation-x={-Math.PI / 2} position-y={-0.25}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#e0e3da" roughness={0.85} />
      </mesh>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FIELD_HALF_SIZE * 2, FIELD_HALF_SIZE * 2]} />
        <meshStandardMaterial color="#f7f8ee" roughness={0.65} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.018}>
        <planeGeometry args={[FIELD_HALF_SIZE * 2, FIELD_HALF_SIZE * 2]} />
        <meshStandardMaterial
          map={texture}
          transparent
          depthWrite={false}
          roughness={0.22}
          metalness={0.05}
        />
      </mesh>
      <Grid
        position={[0, 0.012, 0]}
        args={[FIELD_HALF_SIZE * 2, FIELD_HALF_SIZE * 2]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#e0e4d9"
        sectionSize={4}
        sectionThickness={1.2}
        sectionColor="#d0d7c7"
        fadeDistance={36}
        infiniteGrid={false}
      />
      {[
        [0, 0, -FIELD_HALF_SIZE],
        [0, 0, FIELD_HALF_SIZE],
        [-FIELD_HALF_SIZE, 0, 0],
        [FIELD_HALF_SIZE, 0, 0],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <boxGeometry
            args={
              index < 2
                ? [FIELD_HALF_SIZE * 2, 0.3, 0.25]
                : [0.25, 0.3, FIELD_HALF_SIZE * 2]
            }
          />
          <meshStandardMaterial color="#d5dccc" />
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
  const specialAppearance = useSpecialAppearance();
  const initialized = useRef(false);
  const { camera } = useThree();
  const cameraOffset = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const player = roomRef.current?.state.players.get(playerId);
    const object = group.current;
    if (!player || !object) return;
    const specialActive = player.specialTime >= 0;
    const diving =
      !specialActive &&
      (local
        ? controls.current.keys.has("ShiftLeft") ||
          controls.current.keys.has("ShiftRight")
        : player.dive);
    appearance.update(diving, diving && player.submerged, delta);
    specialAppearance(appearance.body.current, player.specialTime, delta);

    if (!initialized.current) {
      predicted.current.set(player.x, 0, player.z);
      initialized.current = true;
    }

    if (local) {
      const input = controls.current.latestInput;
      const length = Math.hypot(input.x, input.z);
      const scale = length > 1 ? 1 / length : 1;
      const speed = input.dive
        ? player.submerged
          ? DIVE_SPEED
          : DISC_SPEED
        : PLAYER_SPEED;
      if (!specialActive) {
        predicted.current.x += input.x * scale * speed * delta;
        predicted.current.z += input.z * scale * speed * delta;
      } else {
        predicted.current.set(player.x, 0, player.z);
      }
      const error = predicted.current.distanceTo(
        cameraTarget.set(player.x, 0, player.z),
      );
      if (error > 2.5) predicted.current.copy(cameraTarget);
      else predicted.current.lerp(cameraTarget, 1 - Math.exp(-delta * 4));
      object.position.copy(predicted.current);
      object.rotation.y = toModelRotation(controls.current.yaw);

      controls.current.position = {
        x: object.position.x,
        z: object.position.z,
      };
      const yaw = controls.current.yaw;
      cameraOffset.set(Math.sin(yaw) * 6, 3.7, -Math.cos(yaw) * 6);
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
      <mesh ref={appearance.body} castShadow receiveShadow position-y={0.5}>
        <boxGeometry args={[PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh
        ref={appearance.ripple}
        visible={false}
        rotation-x={-Math.PI / 2}
        position-y={0.05}
      >
        <ringGeometry args={[0.45, 0.57, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
        />
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
