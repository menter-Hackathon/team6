import { Grid, Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { Room } from "@colyseus/sdk";
import {
  FIELD_HALF_SIZE,
  INPUT_SEND_RATE,
  PLAYER_SPEED,
  type MoveInput,
} from "@gaya/shared";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GameState } from "./game-types";
import {
  rotateYaw,
  toModelRotation,
  toWorldDirection,
} from "./input-direction";

interface GameSceneProps {
  roomRef: MutableRefObject<Room<GameState> | null>;
  playerIds: string[];
}

interface ControlState {
  keys: Set<string>;
  yaw: number;
  sequence: number;
  latestInput: MoveInput;
}

export function GameScene({ roomRef, playerIds }: GameSceneProps) {
  const controls = useRef<ControlState>({
    keys: new Set(),
    yaw: 0,
    sequence: 0,
    latestInput: { sequence: 0, x: 0, z: 0, yaw: 0 },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) =>
      controls.current.keys.add(event.code);
    const onKeyUp = (event: KeyboardEvent) =>
      controls.current.keys.delete(event.code);
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement) {
        controls.current.yaw = rotateYaw(controls.current.yaw, event.movementX);
      }
    };
    const onClick = () => void document.body.requestPointerLock();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("click", onClick);
    };
  }, []);

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
      <Field />
      {playerIds.map((playerId, index) => (
        <Player
          key={playerId}
          playerId={playerId}
          local={playerId === localId}
          roomRef={roomRef}
          controls={controls}
          color={index % 2 === 0 ? "#ff4f8b" : "#37d9ff"}
        />
      ))}
    </>
  );
}

function Field() {
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FIELD_HALF_SIZE * 2, FIELD_HALF_SIZE * 2]} />
        <meshStandardMaterial color="#272d3d" roughness={0.88} />
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
  const initialized = useRef(false);
  const { camera } = useThree();
  const cameraOffset = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const player = roomRef.current?.state.players.get(playerId);
    const object = group.current;
    if (!player || !object) return;

    if (!initialized.current) {
      predicted.current.set(player.x, 0, player.z);
      initialized.current = true;
    }

    if (local) {
      const input = controls.current.latestInput;
      const length = Math.hypot(input.x, input.z);
      const scale = length > 1 ? 1 / length : 1;
      predicted.current.x += input.x * scale * PLAYER_SPEED * delta;
      predicted.current.z += input.z * scale * PLAYER_SPEED * delta;
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
      <mesh castShadow position-y={0.75}>
        <capsuleGeometry args={[0.42, 0.7, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0.39]}>
        <boxGeometry args={[0.4, 0.18, 0.16]} />
        <meshStandardMaterial
          color="#f5f7ff"
          emissive={color}
          emissiveIntensity={0.3}
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
