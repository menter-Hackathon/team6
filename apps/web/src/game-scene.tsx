import {
  obstacleMove,
  obstacleFloor,
  paintedWall,
  surfacePaintOwned,
  BOX_HEIGHT,
  type PaintedWall,
} from "./dev-obstacle-layout";
import { DevObstacles } from "./dev-obstacles";
import { Grid, Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { Room } from "@colyseus/sdk";
import {
  reactionEffect,
  reactionForKey,
  reactionResponseSchema,
  type ReactionLevel,
  FIELD_HALF_WIDTH,
  FIELD_HALF_DEPTH,
  advanceSpecial,
  advanceJump,
  jumpHeight,
  INPUT_SEND_RATE,
  PLAYER_SPEED,
  PLAYER_SIZE,
  DIVE_SPEED,
  DISC_SPEED,
  INK_SHOT_INTERVAL,
  inkShotScale,
  REACTION_SHOT_INTERVAL,
  updateDiveState,
  type DiveState,
  PAINT_GRID_SIZE,
  isFootprintOwned,
  rasterizePaintStroke,
  type PaintStroke,
  type MoveInput,
  type SpecialShape,
  NEON_COLORS,
  practiceColorOwner,
  teamStartPosition,
} from "@gaya/shared";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bleedSpecialPaint } from "./paint-bleed";
import { AIZUCHI_MOTION_SECONDS, AIZUCHI_LAND_TIME } from "./aizuchi-motion";
import { useAizuchiAppearance } from "./use-aizuchi-appearance";
import { INK_GLOSS, makeInkRelief, useInkEnvironment } from "./ink-material";
import { useSpecialAppearance } from "./special-appearance";
import { InkEffects, INK_SETTLE_SECONDS } from "./ink-effects";
import { currentInkVoice } from "./speech/voice-feedback";
import {
  finishTrace,
  recordInkRoundTrip,
  recordUnconfirmedShot,
  traceStage,
} from "./latency-trace";

/** Unconfirmed after this long means the server rejected the shot. */
const PREDICTION_TIMEOUT_MS = 1500;
/** A local shot drawn before the server confirms it (visual only). */
interface PredictedPaint {
  stroke: PaintStroke & { height?: number };
  traceKey?: string;
}
import type { GameState } from "./game-types";

import {
  rotateYaw,
  rotatePitch,
  toModelRotation,
  toWorldDirection,
} from "./input-direction";

interface GameSceneProps {
  roomRef: MutableRefObject<Room<GameState> | null>;
  playerIds: string[];
  devMode?: boolean;
  showDevObstacles?: boolean;
  devComCount?: number;
  devMatchPhase?: string | undefined;
  devTeamOffset?: number;
  devTeam: "A" | "B";
  devAreaMultiplier?: number;
  devCanPaint?: boolean;
  devCanMove?: boolean;
  devPaintCells: MutableRefObject<Uint8Array | null>;
  specialShape: SpecialShape;
  autoFire?: boolean;
  colorA?: string | undefined;
  colorB?: string | undefined;
}

interface ControlState {
  keys: Set<string>;
  firing: boolean;
  tapPending: boolean;
  specialTime: number;
  jumpTime: number;
  specialShape: SpecialShape;
  yaw: number;
  pitch: number;
  height: number;
  position: { x: number; z: number };
  sequence: number;
  latestInput: MoveInput;
}

export function GameScene({
  roomRef,
  playerIds,
  devMode = false,
  showDevObstacles = true,
  devComCount = 0,
  devMatchPhase,
  devTeamOffset = 0,
  devTeam,
  devAreaMultiplier = 1,
  devCanPaint = true,
  devCanMove = true,
  devPaintCells,
  specialShape,
  autoFire = false,
  colorA = "#ff4f8b",
  colorB = "#37d9ff",
}: GameSceneProps) {
  const aizuchiTime = useRef(AIZUCHI_MOTION_SECONDS);
  const reactionInputs = useRef<
    { level: ReactionLevel; at: number; traceKey?: string }[]
  >([]);
  const devColor = useRef(colorA);
  devColor.current = devTeam === "A" ? colorA : colorB;
  const devOwnPaint = useRef<(x: number, z: number) => boolean>(() => false);
  const activeDevTeam = useRef(devTeam);
  activeDevTeam.current = devTeam;
  const activeDevAreaMultiplier = useRef(devAreaMultiplier);
  activeDevAreaMultiplier.current = devAreaMultiplier;
  const activeDevCanPaint = useRef(devCanPaint);
  activeDevCanPaint.current = devCanPaint;
  const activeDevCanMove = useRef(devCanMove);
  activeDevCanMove.current = devCanMove;
  const controls = useRef<ControlState>({
    keys: new Set(),
    firing: false,
    tapPending: false,
    specialTime: -1,
    jumpTime: -1,
    specialShape: "ink",
    yaw: 0,
    pitch: -0.45,
    height: 0,
    position: { x: 0, z: 0 },
    sequence: 0,
    latestInput: { sequence: 0, x: 0, z: 0, yaw: 0, dive: false },
  });

  useEffect(() => {
    const activateSpecial = () => {
      if (devMode) {
        if (!activeDevCanPaint.current) return;
        if (controls.current.specialTime < 0) {
          controls.current.specialShape = specialShape;
          controls.current.specialTime = 0;
          controls.current.firing = false;
        }
      } else {
        const room = roomRef.current;
        if (room?.state.phase === "playing" || room?.state.phase === "lobby")
          room.send("special", { shape: specialShape });
        controls.current.jumpTime = -1;
      }
    };
    window.addEventListener("activate-special", activateSpecial);
    const enqueueReaction = (level: ReactionLevel, traceKey?: string) => {
      if (reactionEffect(level) && reactionInputs.current.length < 32)
        reactionInputs.current.push({
          level,
          at: performance.now(),
          ...(traceKey ? { traceKey } : {}),
        });
      else finishTrace(traceKey);
    };
    const classified = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const parsed = reactionResponseSchema.safeParse(detail);
      const traceKey: unknown = detail?.traceKey;
      if (parsed.success)
        enqueueReaction(
          parsed.data.level,
          typeof traceKey === "string" ? traceKey : undefined,
        );
    };
    const responseMotion = (event: Event) => {
      const actorId: unknown = (event as CustomEvent).detail?.actorId;
      if (actorId === (devMode ? "dev" : roomRef.current?.sessionId))
        aizuchiTime.current = 0;
    };
    window.addEventListener("aizuchi-motion", responseMotion);
    const resetReactions = () => {
      reactionInputs.current.length = 0;
    };
    window.addEventListener("classified-reaction", classified);
    window.addEventListener("reset-reaction-input", resetReactions);
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !document.pointerLockElement &&
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) ||
          (event.target.tagName === "BUTTON" &&
            (event.code === "Space" || event.code === "Enter")))
      )
        return;
      const level = reactionForKey(event.code);
      if (
        level &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        enqueueReaction(level);
        return;
      }
      if (event.code === "KeyF" && !event.repeat) {
        event.preventDefault();
        activateSpecial();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (
          event.repeat ||
          controls.current.jumpTime >= 0 ||
          controls.current.specialTime >= 0 ||
          controls.current.keys.has("ShiftLeft") ||
          controls.current.keys.has("ShiftRight")
        )
          return;
        if (devMode) controls.current.jumpTime = 0;
        else if (roomRef.current?.state.phase === "playing" || roomRef.current?.state.phase === "lobby") {
          controls.current.jumpTime = 0;
          roomRef.current.send("jump");
        }
        return;
      }
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "ShiftLeft",
          "ShiftRight",
        ].includes(event.code)
      )
        event.preventDefault();
      if (
        ["KeyQ", "KeyE"].includes(event.code) &&
        !event.repeat &&
        !(event.target instanceof HTMLInputElement)
      ) {
        const kind = event.code === "KeyQ" ? "ring" : "line";
        if (
          controls.current.keys.has("ShiftLeft") ||
          controls.current.keys.has("ShiftRight")
        )
          return;
        if (devMode && controls.current.specialTime >= 0) return;
        if (devMode && !activeDevCanPaint.current) return;
        if (devMode) {
          window.dispatchEvent(
            new CustomEvent("dev-paint", {
              detail: {
                revision: 0,
                ...{ height: controls.current.height },
                ...controls.current.position,
                yaw: controls.current.yaw,
                team: activeDevTeam.current,
                kind,
                areaMultiplier: activeDevAreaMultiplier.current,
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
      controls.current.tapPending = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.button === 0 &&
        event.isPrimary &&
        event.target instanceof HTMLCanvasElement
      ) {
        controls.current.firing = true;
        controls.current.tapPending = true;
      }
    };
    const onPointerUp = () => {
      controls.current.firing = false;
    };
    const onLockChange = () => {
      if (!document.pointerLockElement) onBlur();
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement || controls.current.firing) {
        controls.current.yaw = rotateYaw(controls.current.yaw, event.movementX);
        controls.current.pitch = rotatePitch(controls.current.pitch, event.movementY);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof HTMLCanvasElement &&
        (devMode || roomRef.current?.state.phase === "playing" || roomRef.current?.state.phase === "lobby")
      ) {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        if ("pointerType" in event && event.pointerType === "touch") return;
        void event.target.requestPointerLock().catch(() => {
          /* Drag-to-aim remains available if pointer lock is unavailable. */
        });
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointercancel", onBlur);
    window.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerlockchange", onLockChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("click", onClick);
    return () => {
      reactionInputs.current.length = 0;
      aizuchiTime.current = AIZUCHI_MOTION_SECONDS;
      window.removeEventListener("aizuchi-motion", responseMotion);
      window.removeEventListener("classified-reaction", classified);
      window.removeEventListener("reset-reaction-input", resetReactions);
      window.removeEventListener("activate-special", activateSpecial);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointercancel", onBlur);
      window.removeEventListener("pointerup", onPointerUp);
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
      if (!room || (room.state.phase !== "playing" && room.state.phase !== "lobby")) return;
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
        dive:
          (keys.has("ShiftLeft") || keys.has("ShiftRight")) &&
          controls.current.jumpTime < 0,
      };
      controls.current.latestInput = input;
      room.send("move", input);
    }, 1000 / INPUT_SEND_RATE);
    return () => window.clearInterval(interval);
  }, [roomRef]);

  const shotClock = useRef(0);
  const reactionClock = useRef(0);
  useFrame((_, delta) => {
    shotClock.current = Math.max(0, shotClock.current - delta);
    reactionClock.current = Math.max(0, reactionClock.current - delta);
    const control = controls.current;
    const responseAirborne = aizuchiTime.current < AIZUCHI_LAND_TIME;
    aizuchiTime.current = Math.min(
      AIZUCHI_MOTION_SECONDS,
      aizuchiTime.current + Math.min(delta, 0.05),
    );
    const networkPlayer = roomRef.current?.state.players.get(
      roomRef.current.sessionId,
    );
    const specialActive =
      (devMode ? control.specialTime : (networkPlayer?.specialTime ?? -1)) >= 0;
    const button = document.getElementById(
      "special-button",
    ) as HTMLButtonElement | null;
    if (button) {
      button.disabled =
        specialActive ||
        (devMode && !activeDevCanPaint.current) ||
        (!devMode && roomRef.current?.state.phase !== "playing" && roomRef.current?.state.phase !== "lobby");
      button.textContent = specialActive
        ? "回転ジャンプ中…"
        : `F  必殺技 · ${specialShape === "ink" ? "● インク" : specialShape === "heart" ? "♥ ハート" : "★ スター"}スラム`;
    }
    if (
      specialActive ||
      responseAirborne ||
      control.keys.has("ShiftLeft") ||
      control.keys.has("ShiftRight") ||
      networkPlayer?.dive
    )
      control.tapPending = false;
    const queue = reactionInputs.current;
    while (queue.length && performance.now() - queue[0]!.at > 15000)
      finishTrace(queue.shift()!.traceKey);
    const canReact =
      !specialActive &&
      !responseAirborne &&
      !control.keys.has("ShiftLeft") &&
      !control.keys.has("ShiftRight") &&
      !networkPlayer?.dive &&
      (devMode ||
        roomRef.current?.state.phase === "lobby" ||
        roomRef.current?.state.phase === "playing");
    let reactionKind: "reaction-fan" | "ink" | undefined;
    let traceKey: string | undefined;
    if (
      queue.length &&
      canReact &&
      (reactionEffect(queue[0]!.level) === "reaction-fan"
        ? reactionClock.current <= 0
        : shotClock.current <= 0)
    ) {
      const reaction = queue.shift()!;
      const action = reactionEffect(reaction.level);
      traceKey = reaction.traceKey;
      if (action === "slam") {
        window.dispatchEvent(new Event("activate-special"));
        traceStage(traceKey, "sent");
        finishTrace(traceKey);
        return;
      }
      if (action) reactionKind = action;
    }
    if (
      specialActive ||
      responseAirborne ||
      (!autoFire && !control.firing && !control.tapPending && !reactionKind) ||
      control.keys.has("ShiftLeft") ||
      control.keys.has("ShiftRight") ||
      (!reactionKind && shotClock.current > 0)
    )
      return;
    if (devMode && !activeDevCanPaint.current) return;
    const kind = reactionKind ?? "ink";
    if (kind === "reaction-fan") reactionClock.current = REACTION_SHOT_INTERVAL;
    else {
      shotClock.current = INK_SHOT_INTERVAL;
      control.tapPending = false;
    }
    if (devMode && kind === "reaction-fan")
      window.dispatchEvent(
        new CustomEvent("aizuchi-motion", { detail: { actorId: "dev" } }),
      );
    // D-085: ink is 0.9x silent, 1.2x while voiced, 1.5x mid long sentence.
    const voice = kind === "ink" ? currentInkVoice() : undefined;
    if (devMode)
      window.dispatchEvent(
        new CustomEvent("dev-paint", {
          detail: {
            revision: 0,
            ...{ height: controls.current.height },
            ...control.position,
            yaw: control.yaw,
            team: activeDevTeam.current,
            kind,
            pitch: control.pitch,
            areaMultiplier: activeDevAreaMultiplier.current,
            ...(kind === "ink" ? { scale: inkShotScale(voice) } : {}),
          } satisfies PaintStroke,
        }),
      );
    else if (
      networkPlayer &&
      (roomRef.current?.state.phase === "playing" ||
        roomRef.current?.state.phase === "lobby")
    ) {
      const room = roomRef.current;
      room.send("paint", {
        kind,
        pitch: control.pitch,
        ...(voice ? { voice } : {}),
      });
      // Draw our own shot now; the server's echo then only bakes ownership.
      const practice = room.state.phase === "lobby";
      window.dispatchEvent(
        new CustomEvent<PredictedPaint>("predicted-paint", {
          detail: {
            stroke: {
              revision: 0,
              actorId: room.sessionId,
              height: control.height,
              ...control.position,
              yaw: control.yaw,
              pitch: control.pitch,
              team: networkPlayer.team === "B" ? "B" : "A",
              ...(practice
                ? { practiceColor: networkPlayer.practiceColor }
                : {}),
              kind,
              ...(kind === "ink" ? { scale: inkShotScale(voice) } : {}),
            },
            ...(traceKey ? { traceKey } : {}),
          },
        }),
      );
    }
    traceStage(traceKey, "sent");
    if (devMode) finishTrace(traceKey);
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

      {devMode && showDevObstacles && (
        <DevObstacles colorA={colorA} colorB={colorB} canPaint={devCanPaint} />
      )}
      <Field
        room={roomRef.current}
        devMode={devMode}
        devOwnPaint={devOwnPaint}
        devPaintCells={devPaintCells}
        devCanPaint={activeDevCanPaint}
        colorA={colorA}
        colorB={colorB}
      />
      {devMode && (
        <DevPlayer
          controls={controls}
          ownPaint={devOwnPaint}
          obstacles={showDevObstacles}
          devColor={devColor}
          color={devTeam === "A" ? colorA : colorB}
          devTeam={activeDevTeam}
          areaMultiplier={activeDevAreaMultiplier}
          canPaint={activeDevCanPaint}
          canMove={activeDevCanMove}
          startPosition={devMatchPhase ? teamStartPosition(devTeamOffset % 2 === 0 ? "A" : "B", 0, (devComCount + 1) / 2) : undefined}
          phase={devMatchPhase}
        />
      )}
      {devMode &&
        Array.from({ length: devComCount }, (_, index) => {
          const rosterIndex = index + 1;
          const team = (rosterIndex + devTeamOffset) % 2 === 0 ? "A" : "B";
          const angle = (index / Math.max(devComCount, 1)) * Math.PI * 2;
          const lineup = devMatchPhase === "countdown" || devMatchPhase === "playing" || devMatchPhase === "result";
          const slot = Array.from({ length: rosterIndex + 1 }, (_, playerIndex) => playerIndex)
            .filter((playerIndex) => (playerIndex + devTeamOffset) % 2 === (rosterIndex + devTeamOffset) % 2).length - 1;
          const start = teamStartPosition(team, slot, (devComCount + 1) / 2);
          return (
            <group
              key={index}
              position={lineup ? [start.x, 0, start.z] : [Math.cos(angle) * 5, 0, Math.sin(angle) * 5]}
            >
              <mesh castShadow receiveShadow position-y={0.5}>
                <boxGeometry args={[PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE]} />
                <meshStandardMaterial color={team === "A" ? colorA : colorB} roughness={0.45} metalness={0.1} />
              </mesh>
              <Html position={[0, 1.55, 0]} center zIndexRange={[2, 0]} style={{ pointerEvents: "none" }}>
                <span className="player-gamertag" style={{ borderColor: team === "A" ? colorA : colorB }}>COM {index + 1}</span>
              </Html>
            </group>
          );
        })}
      {playerIds.map((playerId) => (
        <Player
          key={playerId}
          playerId={playerId}
          displayName={
            roomRef.current?.state.players.get(playerId)?.displayName ?? ""
          }
          local={playerId === localId}
          roomRef={roomRef}
          controls={controls}
          color={
            roomRef.current?.state.phase === "lobby"
              ? (roomRef.current?.state.players.get(playerId)?.practiceColor ??
                colorA)
              : roomRef.current?.state.players.get(playerId)?.team === "B"
                ? colorB
                : colorA
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

function orbitPlayer(camera: THREE.Camera, position: THREE.Vector3, yaw: number, pitch: number) {
  const centerY = position.y + PLAYER_SIZE / 2;
  const radius = 6.5;
  const horizontal = Math.cos(pitch) * radius;
  camera.position.set(
    position.x + Math.sin(yaw) * horizontal,
    centerY - Math.sin(pitch) * radius,
    position.z - Math.cos(yaw) * horizontal,
  );
  camera.lookAt(position.x, centerY, position.z);
}

function DevPlayer({
  controls,
  ownPaint,
  color,
  devColor,
  obstacles,
  devTeam,
  areaMultiplier,
  canPaint,
  canMove,
  startPosition,
  phase,
}: {
  controls: MutableRefObject<ControlState>;
  ownPaint: MutableRefObject<(x: number, z: number) => boolean>;
  color: string;
  devColor: MutableRefObject<string>;
  obstacles: boolean;
  devTeam: MutableRefObject<"A" | "B">;
  areaMultiplier: MutableRefObject<number>;
  canPaint: MutableRefObject<boolean>;
  canMove: MutableRefObject<boolean>;
  startPosition: { x: number; z: number; yaw: number } | undefined;
  phase: string | undefined;
}) {
  const group = useRef<THREE.Group>(null);
  const previousPhase = useRef<string | undefined>(undefined);
  const appearance = useDiveAppearance();
  const specialAppearance = useSpecialAppearance();
  const aizuchiAppearance = useAizuchiAppearance("dev");
  const { camera } = useThree();
  const jumpBase = useRef(0),
    wasJumping = useRef(false),
    fallSpeed = useRef(0);
  const climbingWall = useRef<PaintedWall | null>(null);
  const wallRipple = useRef<THREE.Mesh>(null);
  useEffect(() => {
    const reset = () => {
      if (!group.current) return;
      group.current.position.set(4, 0, 6.5);
      controls.current.position = { x: 4, z: 6.5 };
      controls.current.height = 0;
      controls.current.yaw = 0;
      controls.current.pitch = -0.45;
      controls.current.keys.clear();
      controls.current.firing = false;
      controls.current.jumpTime = -1;
      controls.current.specialTime = -1;
      wasJumping.current = false;
      fallSpeed.current = 0;
      climbingWall.current = null;
    };
    window.addEventListener("dev-obstacle-start", reset);
    return () => window.removeEventListener("dev-obstacle-start", reset);
  }, [controls]);
  const diveState = useRef<DiveState>({
    submerged: false,
    gapSeconds: 0,
    team: 1,
  });
  useFrame((_, delta) => {
    const object = group.current;
    if (!object) return;
    if (phase === "countdown" && previousPhase.current !== "countdown" && startPosition) {
      object.position.set(startPosition.x, 0, startPosition.z);
      controls.current.position = { x: startPosition.x, z: startPosition.z };
      controls.current.yaw = startPosition.yaw;
      object.rotation.y = toModelRotation(startPosition.yaw);
    }
    if (phase !== previousPhase.current) {
      controls.current.height = 0;
      wasJumping.current = false;
      fallSpeed.current = 0;
      climbingWall.current = null;
    }
    previousPhase.current = phase;
    if (!canMove.current) {
      controls.current.jumpTime = -1;
      controls.current.specialTime = -1;
      object.position.y = 0;
      controls.current.position = { x: object.position.x, z: object.position.z };
      const yaw = controls.current.yaw;
      orbitPlayer(camera, object.position, yaw, controls.current.pitch);
      return;
    }
    const previousY = object.position.y;
    if (controls.current.jumpTime >= 0 && !wasJumping.current)
      jumpBase.current = previousY;
    controls.current.jumpTime = advanceJump(
      controls.current.jumpTime,
      Math.min(delta, 0.1),
    );
    object.position.y =
      controls.current.jumpTime >= 0
        ? jumpBase.current + jumpHeight(controls.current.jumpTime)
        : previousY;
    const special = advanceSpecial(
      controls.current.specialTime,
      Math.min(delta, 0.1),
    );
    controls.current.specialTime = special.time;
    const specialActive = special.time >= 0 || special.landed;
    if (special.landed && canPaint.current)
      window.dispatchEvent(
        new CustomEvent("dev-paint", {
          detail: {
            revision: 0,
            ...{ height: controls.current.height },
            x: object.position.x,
            z: object.position.z,
            yaw: controls.current.yaw,
            team: devTeam.current,
            areaMultiplier: areaMultiplier.current,
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
      controls.current.jumpTime = -1;
      object.position.y = obstacles
        ? obstacleFloor(object.position.x, object.position.z)
        : 0;
    }
    const length = Math.hypot(direction.x, direction.z);
    if (length > 1) {
      direction.x /= length;
      direction.z /= length;
    }
    const dive =
      !specialActive &&
      controls.current.jumpTime < 0 &&
      (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    const before = updateDiveState(
      diveState.current,
      dive,
      obstacles
        ? surfacePaintOwned(
            object.position.x,
            object.position.z,
            object.position.y,
            devColor.current,
            ownPaint.current,
          )
        : ownPaint.current(object.position.x, object.position.z),
      0,
      devTeam.current === "A" ? 1 : 2,
    );
    const submerged = before.submerged;
    const oldX = object.position.x,
      oldZ = object.position.z;
    const speed = dive ? (submerged ? DIVE_SPEED : DISC_SPEED) : PLAYER_SPEED;
    object.position.x = THREE.MathUtils.clamp(
      object.position.x + direction.x * speed * Math.min(delta, 0.05),
      -FIELD_HALF_WIDTH + 0.5,
      FIELD_HALF_WIDTH - 0.5,
    );
    object.position.z = THREE.MathUtils.clamp(
      object.position.z + direction.z * speed * Math.min(delta, 0.05),
      -FIELD_HALF_DEPTH + 0.5,
      FIELD_HALF_DEPTH - 0.5,
    );
    if (obstacles) {
      const resolved = obstacleMove(
        oldX,
        oldZ,
        object.position.x,
        object.position.z,
        object.position.y,
      );
      object.position.x = resolved.x;
      object.position.z = resolved.z;
    }
    const wall =
      obstacles && dive
        ? paintedWall(
            object.position.x,
            object.position.z,
            previousY,
            devColor.current,
          )
        : null;
    const climbing =
      wall && direction.x * wall.nx + direction.z * wall.nz < -0.1;
    let mantled = false;
    if (climbing && wall) {
      object.position.x = wall.x + wall.nx * 0.035;
      object.position.z = wall.z + wall.nz * 0.035;
      object.position.y = previousY + 2.6 * Math.min(delta, 0.05);
      controls.current.jumpTime = -1;
      fallSpeed.current = 0;
      if (object.position.y >= BOX_HEIGHT - 1.1) {
        object.position.y = BOX_HEIGHT;
        object.position.x = wall.x - wall.nx * 0.65;
        object.position.z = wall.z - wall.nz * 0.65;
        mantled = true;
      }
    } else if (climbingWall.current) {
      const previous = climbingWall.current;
      object.position.x = previous.x + previous.nx * 0.53;
      object.position.z = previous.z + previous.nz * 0.53;
    }
    const candidateFloor = obstacles
      ? obstacleFloor(object.position.x, object.position.z)
      : 0;
    const floor =
      previousY >= candidateFloor - 0.02 || object.position.y >= candidateFloor
        ? candidateFloor
        : 0;
    if (!specialActive && !climbing && !mantled) {
      if (controls.current.jumpTime >= 0) {
        if (object.position.y <= floor && object.position.y < previousY) {
          object.position.y = floor;
          controls.current.jumpTime = -1;
          fallSpeed.current = 0;
        }
      } else {
        fallSpeed.current =
          previousY > floor
            ? fallSpeed.current + 18 * Math.min(delta, 0.05)
            : 0;
        object.position.y = Math.max(
          floor,
          previousY - fallSpeed.current * Math.min(delta, 0.05),
        );
      }
    }
    climbingWall.current = climbing && !mantled ? wall : null;
    wasJumping.current = controls.current.jumpTime >= 0;
    controls.current.height = object.position.y;
    diveState.current = updateDiveState(
      before,
      dive,
      obstacles
        ? surfacePaintOwned(
            object.position.x,
            object.position.z,
            object.position.y,
            devColor.current,
            ownPaint.current,
          )
        : ownPaint.current(object.position.x, object.position.z),
      Math.min(delta, 0.1),
      devTeam.current === "A" ? 1 : 2,
    );
    const nowSubmerged = diveState.current.submerged;
    const onObstacleTop =
      obstacles &&
      Math.abs(object.position.y - BOX_HEIGHT) < 0.02 &&
      obstacleFloor(object.position.x, object.position.z) === BOX_HEIGHT;
    if (
      (!dive || onObstacleTop) &&
      canPaint.current &&
      !specialActive &&
      !climbingWall.current &&
      controls.current.jumpTime < 0 &&
      Math.hypot(object.position.x - oldX, object.position.z - oldZ) > 0.001
    ) {
      window.dispatchEvent(
        new CustomEvent("dev-paint", {
          detail: {
            revision: 0,
            ...{ height: controls.current.height },
            fromX: oldX,
            fromZ: oldZ,
            x: object.position.x,
            z: object.position.z,
            yaw: controls.current.yaw,
            team: devTeam.current,
            areaMultiplier: areaMultiplier.current,
            kind: "footprint",
          } satisfies PaintStroke,
        }),
      );
    }
    appearance.update(dive, nowSubmerged, delta);
    if (climbingWall.current) {
      if (appearance.body.current) appearance.body.current.visible = false;
      if (appearance.ripple.current) appearance.ripple.current.visible = false;
    }
    specialAppearance(
      appearance.body.current,
      controls.current.specialTime,
      delta,
    );
    aizuchiAppearance(
      appearance.body.current,
      delta,
      specialActive || dive || Boolean(climbingWall.current),
    );
    object.rotation.y = toModelRotation(controls.current.yaw);
    if (wallRipple.current) {
      const current = climbingWall.current;
      wallRipple.current.visible = Boolean(current);
      if (current) {
        const localNormal = new THREE.Vector3(
          current.nx,
          0,
          current.nz,
        ).applyAxisAngle(new THREE.Vector3(0, 1, 0), -object.rotation.y);
        wallRipple.current.position.set(
          localNormal.x * 0.025,
          0.45,
          localNormal.z * 0.025,
        );
        wallRipple.current.rotation.set(
          0,
          Math.atan2(localNormal.x, localNormal.z),
          0,
        );
      }
    }
    controls.current.position = { x: object.position.x, z: object.position.z };
    const yaw = controls.current.yaw;
    orbitPlayer(camera, object.position, yaw, controls.current.pitch);
    const readout = document.getElementById("dev-readout");
    if (readout)
      readout.textContent = `状態 ${climbingWall.current ? "壁面潜航 ↑" : nowSubmerged ? "潜航 ×1.5" : "通常"} / 高さ ${object.position.y.toFixed(1)} / X ${object.position.x.toFixed(1)} / Z ${object.position.z.toFixed(1)} / 向き ${Math.round((yaw * 180) / Math.PI)}°`;
  });
  return (
    <group ref={group}>
      <mesh ref={wallRipple} visible={false} scale={[1, 1.35, 1]}>
        <ringGeometry args={[0.23, 0.29, 36]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={appearance.body} castShadow receiveShadow position-y={0.5}>
        <boxGeometry args={[PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE]} />
        <meshStandardMaterial color={color} />
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
  devPaintCells,
  devCanPaint,
  colorA,
  colorB,
}: {
  room: Room<GameState> | null;
  devMode: boolean;
  devOwnPaint: MutableRefObject<(x: number, z: number) => boolean>;
  devPaintCells: MutableRefObject<Uint8Array | null>;
  devCanPaint: MutableRefObject<boolean>;
  colorA: string;
  colorB: string;
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
  const inkEnvironment = useInkEnvironment();
  useEffect(() => effects.setEnvironment(inkEnvironment), [effects, inkEnvironment]);
  const inkRelief = useMemo(() => makeInkRelief(PAINT_GRID_SIZE), []);
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
  devPaintCells.current = devMode ? cells : null;
  const colors = useRef({ colorA, colorB });
  colors.current = { colorA, colorB };
  useEffect(() => {
    if (!room && !devMode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    effects.clear();
    effects.setColors(colors.current.colorA, colors.current.colorB);
    const practiceRgb = NEON_COLORS.map(({ hex }) =>
      [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)),
    );
    const setPixel = (
      data: Uint8ClampedArray,
      offset: number,
      team: number,
    ) => {
      const practice =
        devMode ||
        room?.state.phase === "lobby" ||
        room?.state.phase === "team_selection";
      const currentA = [1, 3, 5].map((index) =>
        parseInt(colors.current.colorA.slice(index, index + 2), 16),
      );
      const currentB = [1, 3, 5].map((index) =>
        parseInt(colors.current.colorB.slice(index, index + 2), 16),
      );
      const rgb =
        practice && !devMode && practiceRgb[team - 1]
          ? practiceRgb[team - 1]!
          : team === 1
            ? currentA
            : currentB;
      data[offset] = rgb[0]!;
      data[offset + 1] = rgb[1]!;
      data[offset + 2] = rgb[2]!;
      data[offset + 3] = 255;
    };
    cells.fill(0);
    revision.current = 0;
    ctx.clearRect(0, 0, PAINT_GRID_SIZE, PAINT_GRID_SIZE);
    texture.needsUpdate = true;
    const image = ctx.createImageData(PAINT_GRID_SIZE, PAINT_GRID_SIZE);
    if (devMode)
      devOwnPaint.current = (x, z) =>
        isFootprintOwned(
          cells,
          x,
          z,
          practiceColorOwner(colors.current.colorA),
        );
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
        const team = stroke.practiceColor
          ? practiceColorOwner(stroke.practiceColor)
          : stroke.team === "A"
            ? 1
            : 2;
        if (stroke.kind === "slam") {
          const bleed = bleedSpecialPaint(
            stroke,
            image,
            colors.current.colorA,
            colors.current.colorB,
          );
          if (bleed) {
            minX = Math.min(minX, bleed.left);
            minY = Math.min(minY, bleed.top);
            maxX = Math.max(maxX, bleed.right);
            maxY = Math.max(maxY, bleed.bottom);
          }
        }
        rasterizePaintStroke(stroke, (x, y) => {
          const offset = (y * PAINT_GRID_SIZE + x) * 4;
          setPixel(image.data, offset, team);
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
      const now = performance.now();
      const prediction =
        !devMode && stroke.actorId && stroke.actorId === room?.sessionId
          ? claimPrediction(stroke.kind, now)
          : undefined;
      if (
        !prediction &&
        !devMode &&
        stroke.kind === "reaction-fan" &&
        stroke.actorId
      )
        window.dispatchEvent(
          new CustomEvent("aizuchi-motion", {
            detail: { actorId: stroke.actorId },
          }),
        );
      // Our own shot was already drawn at send time; don't fire it twice.
      const flightSeconds = prediction
        ? prediction.flight
        : effects.emit(stroke);
      if (prediction) {
        if (stroke.kind === "ink") recordInkRoundTrip(now - prediction.at);
        traceStage(prediction.traceKey, "echo", {}, now);
        finishTrace(prediction.traceKey);
      }
      const team = stroke.practiceColor
        ? practiceColorOwner(stroke.practiceColor)
        : stroke.team === "A"
          ? 1
          : 2;
      rasterizePaintStroke(stroke, (x, y) => {
        cells[y * PAINT_GRID_SIZE + x] = team;
      });
      // Bake only after the airborne drop lands and its transient splat has expanded.
      displayQueue.push({
        stroke,
        at:
          (prediction?.at ?? now) + (flightSeconds + INK_SETTLE_SECONDS) * 1000,
      });
    };
    // Shots we drew before the server confirmed them, oldest first.
    const predictions: {
      kind: PaintStroke["kind"];
      at: number;
      flight: number;
      traceKey?: string;
    }[] = [];
    const expirePredictions = (now: number) => {
      while (
        predictions.length &&
        now - predictions[0]!.at > PREDICTION_TIMEOUT_MS
      ) {
        // Rejected by the server (rate limit, dive, phase): it never painted.
        recordUnconfirmedShot();
        finishTrace(predictions.shift()!.traceKey);
      }
    };
    const claimPrediction = (kind: PaintStroke["kind"], now: number) => {
      expirePredictions(now);
      const index = predictions.findIndex((entry) => entry.kind === kind);
      return index < 0 ? undefined : predictions.splice(index, 1)[0];
    };
    const predicted = (event: Event) => {
      if (disposed || devMode) return;
      const { stroke, traceKey } = (event as CustomEvent<PredictedPaint>)
        .detail;
      const now = performance.now();
      expirePredictions(now);
      if (stroke.kind === "reaction-fan" && stroke.actorId)
        window.dispatchEvent(
          new CustomEvent("aizuchi-motion", {
            detail: { actorId: stroke.actorId },
          }),
        );
      predictions.push({
        kind: stroke.kind,
        at: now,
        flight: effects.emit(stroke),
        ...(traceKey ? { traceKey } : {}),
      });
    };
    window.addEventListener("predicted-paint", predicted);
    const devPaint = (event: Event) => {
      if (devCanPaint.current) paint((event as CustomEvent<PaintStroke>).detail);
    };
    const resetDevPaint = () => {
      displayQueue.length = 0;
      effects.clear();
      cells.fill(0);
      image.data.fill(0);
      ctx.clearRect(0, 0, PAINT_GRID_SIZE, PAINT_GRID_SIZE);
      texture.needsUpdate = true;
    };
    if (devMode) window.addEventListener("dev-paint", devPaint);
    if (devMode) window.addEventListener("dev-reset-paint", resetDevPaint);
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
          setPixel(image.data, offset, team);
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
      window.removeEventListener("predicted-paint", predicted);
      predictions.length = 0;
      window.removeEventListener("dev-reset-paint", resetDevPaint);
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
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, FIELD_HALF_DEPTH * 2]} />
        <meshStandardMaterial color="#f7f8ee" roughness={0.65} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.018}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, FIELD_HALF_DEPTH * 2]} />
        <meshPhysicalMaterial
          map={texture}
          transparent
          depthWrite={false}
          {...INK_GLOSS}
          envMap={inkEnvironment}
          onBeforeCompile={inkRelief}
        />
      </mesh>
      {/* The underside is visible only to a camera below the floor. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.25}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial color="#e0e3da" side={THREE.BackSide} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, FIELD_HALF_DEPTH * 2]} />
        <meshBasicMaterial color="#f7f8ee" side={THREE.BackSide} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.018}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, FIELD_HALF_DEPTH * 2]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <Grid
        position={[0, 0.012, 0]}
        args={[FIELD_HALF_WIDTH * 2, FIELD_HALF_DEPTH * 2]}
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
        [0, 0, -FIELD_HALF_DEPTH],
        [0, 0, FIELD_HALF_DEPTH],
        [-FIELD_HALF_WIDTH, 0, 0],
        [FIELD_HALF_WIDTH, 0, 0],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <boxGeometry
            args={
              index < 2
                ? [FIELD_HALF_WIDTH * 2, 0.3, 0.25]
                : [0.25, 0.3, FIELD_HALF_DEPTH * 2]
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
  displayName: string;
  local: boolean;
  color: string;
  roomRef: MutableRefObject<Room<GameState> | null>;
  controls: MutableRefObject<ControlState>;
}

function Player({
  playerId,
  displayName,
  local,
  color,
  roomRef,
  controls,
}: PlayerProps) {
  const group = useRef<THREE.Group>(null);
  const predicted = useRef(new THREE.Vector3());
  const appearance = useDiveAppearance();
  const specialAppearance = useSpecialAppearance();
  const aizuchiAppearance = useAizuchiAppearance(playerId);
  const initialized = useRef(false);
  const previousPhase = useRef<string | undefined>(undefined);
  const { camera } = useThree();
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const player = roomRef.current?.state.players.get(playerId);
    const object = group.current;
    if (!player || !object) return;
    const phase = roomRef.current?.state.phase;
    if (phase === "countdown" && previousPhase.current !== "countdown") {
      predicted.current.set(player.x, 0, player.z);
      object.position.set(player.x, 0, player.z);
      object.rotation.y = toModelRotation(player.yaw);
      if (local) controls.current.yaw = player.yaw;
    }
    previousPhase.current = phase;
    const specialActive = player.specialTime >= 0;
    if (local && specialActive) controls.current.jumpTime = -1;
    if (local)
      controls.current.jumpTime = advanceJump(
        controls.current.jumpTime,
        Math.min(delta, 0.1),
      );
    const jumpTime = local ? controls.current.jumpTime : player.jumpTime;
    const diving =
      !specialActive &&
      jumpTime < 0 &&
      (local
        ? controls.current.keys.has("ShiftLeft") ||
          controls.current.keys.has("ShiftRight")
        : player.dive);
    appearance.update(diving, diving && player.submerged, delta);
    specialAppearance(appearance.body.current, player.specialTime, delta);
    aizuchiAppearance(appearance.body.current, delta, specialActive || diving);

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
      if (!specialActive && (phase === "playing" || phase === "lobby")) {
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
      object.position.y = jumpHeight(jumpTime);
      object.rotation.y = toModelRotation(controls.current.yaw);

      controls.current.position = {
        x: object.position.x,
        z: object.position.z,
      };
      const yaw = controls.current.yaw;
      orbitPlayer(camera, object.position, yaw, controls.current.pitch);
    } else {
      cameraTarget.set(player.x, 0, player.z);
      object.position.lerp(cameraTarget, 1 - Math.exp(-delta * 10));
      object.position.y = jumpHeight(jumpTime);
      object.rotation.y = THREE.MathUtils.lerp(
        object.rotation.y,
        toModelRotation(player.yaw),
        0.18,
      );
    }
  });

  return (
    <group ref={group}>
      {displayName && (
        <Html
          center
          position={[0, 1.55, 0]}
          zIndexRange={[2, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span className="player-gamertag" style={{ borderColor: color }}>
            {displayName}
          </span>
        </Html>
      )}
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
