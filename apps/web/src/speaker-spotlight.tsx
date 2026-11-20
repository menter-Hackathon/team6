import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Room } from "@colyseus/sdk";
import type { PaintStroke } from "@gaya/shared";
import type { GameState } from "./game-types";
import "./ink-theme.css";

/**
 * Presenter spotlight: while someone is speaking, every gaya that lands (相槌 fan or
 * long-sentence slam) bursts ink around them, raises a decaying "hype" level that brightens
 * the spotlight and grows the ring, and floats a 「◯◯のガヤ！」 label. Visual only.
 *
 * Dev preview: window events from the dev panel —
 *   "speaker-preview" (detail: boolean)  treat the dev character as the presenter
 *   "speaker-preview-gaya" (detail: "fan" | "slam")  fake one incoming gaya
 */
type Gaya = "fan" | "slam";
const GAYA_HYPE: Record<Gaya, number> = { fan: 0.22, slam: 0.5 };
const HYPE_DECAY_PER_SECOND = 0.12;
const MAX_DROPS = 260;
const PREVIEW_COLORS = ["#ff3d8b", "#19d3ff", "#a6f23a", "#f7e83a", "#b66bff"];
const HYPE_CALLS = [
  { at: 0.85, text: "大盛り上がり🔥" },
  { at: 0.55, text: "盛り上がってる！" },
  { at: 0.25, text: "いい感じ！" },
];

interface Drop {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  life: number;
}
interface Callout {
  id: number;
  text: string;
  color: string;
  born: number;
}

export function SpeakerSpotlight({
  room,
  devMode,
  devAnchor,
  devPresenter,
  colorA,
  colorB,
}: {
  room: Room<GameState> | null;
  devMode: boolean;
  /** Dev character position (used for the preview). */
  devAnchor: MutableRefObject<{ x: number; z: number; height: number }>;
  devPresenter?: "local" | { x: number; z: number } | undefined;
  colorA: string;
  colorB: string;
}) {
  const [preview, setPreview] = useState(false);
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [hypeCall, setHypeCall] = useState("");
  const hype = useRef(0);
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.SpotLight>(null);
  const ring = useRef<THREE.Mesh>(null);
  const drops = useRef<Drop[]>([]);
  const nextId = useRef(0);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const colors = useRef({ colorA, colorB });
  colors.current = { colorA, colorB };
  const active = devMode ? preview || devPresenter !== undefined : speakerId !== null;

  // Who is presenting right now (network matches).
  useEffect(() => {
    if (!room) return;
    const update = () => {
      const s = room.state;
      const id =
        s.phase === "playing" && s.turnIndex > 0
          ? (s.speakerOrder[s.turnIndex - 1] ?? null)
          : null;
      setSpeakerId(id && s.players.get(id) ? id : null);
    };
    update();
    room.onStateChange(update);
    return () => room.onStateChange.remove(update);
  }, [room]);

  const burst = (gaya: Gaya, color: string, label: string) => {
    hype.current = Math.min(1, hype.current + GAYA_HYPE[gaya]);
    const g = group.current;
    if (g) {
      const count = gaya === "slam" ? 34 : 16;
      for (let i = 0; i < count && drops.current.length < MAX_DROPS; i++) {
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.15,
          metalness: 0.05,
          transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        const size = (gaya === "slam" ? 0.16 : 0.11) * (0.6 + Math.random() * 0.8);
        mesh.scale.setScalar(size);
        mesh.position.set(0, 1.2, 0);
        const angle = Math.random() * Math.PI * 2;
        const speed = (gaya === "slam" ? 5 : 3.2) * (0.6 + Math.random() * 0.7);
        const velocity = new THREE.Vector3(
          Math.cos(angle) * speed,
          (gaya === "slam" ? 6 : 4.5) * (0.6 + Math.random() * 0.6),
          Math.sin(angle) * speed,
        );
        g.add(mesh);
        drops.current.push({ mesh, velocity, age: 0, life: 0.9 + Math.random() * 0.5 });
      }
    }
    const id = ++nextId.current;
    setCallouts((list) => [...list.slice(-5), { id, text: label, color, born: performance.now() }]);
    window.setTimeout(() => setCallouts((list) => list.filter((c) => c.id !== id)), 1400);
  };

  // Real gaya: reaction paints broadcast by the server while someone is presenting.
  useEffect(() => {
    if (!room) return;
    const off = room.onMessage("paint", (stroke: PaintStroke) => {
      const s = room.state;
      if (s.phase !== "playing" || s.turnIndex === 0) return;
      const presenter = s.speakerOrder[s.turnIndex - 1];
      if (!presenter || stroke.actorId === presenter) return;
      const gaya: Gaya | null =
        stroke.kind === "reaction-fan" ? "fan" : stroke.kind === "slam" ? "slam" : null;
      if (!gaya) return;
      const color = stroke.team === "B" ? colors.current.colorB : colors.current.colorA;
      const name = stroke.actorId ? s.players.get(stroke.actorId)?.displayName : undefined;
      burst(gaya, color, name ? `${name}のガヤ！` : "ガヤ！");
    });
    return () => off();
    // burst only touches refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Dev preview controls.
  useEffect(() => {
    if (!devMode) return;
    const onPreview = (event: Event) => setPreview(Boolean((event as CustomEvent).detail));
    const onGaya = (event: Event) => {
      const gaya: Gaya = (event as CustomEvent).detail === "slam" ? "slam" : "fan";
      const color = PREVIEW_COLORS[Math.floor(Math.random() * PREVIEW_COLORS.length)]!;
      burst(gaya, color, gaya === "slam" ? "長いガヤ！" : "ナイス相槌！");
    };
    window.addEventListener("speaker-preview", onPreview);
    window.addEventListener("speaker-preview-gaya", onGaya);
    return () => {
      window.removeEventListener("speaker-preview", onPreview);
      window.removeEventListener("speaker-preview-gaya", onGaya);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devMode]);

  useEffect(
    () => () => {
      for (const d of drops.current) (d.mesh.material as THREE.Material).dispose();
      geometry.dispose();
    },
    [geometry],
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const g = group.current;
    if (!g) return;
    // Follow the presenter.
    let anchor: { x: number; z: number; height: number } | null = null;
    if (devMode && (devPresenter === "local" || (!devPresenter && preview)))
      anchor = devAnchor.current;
    else if (devMode && typeof devPresenter === "object")
      anchor = { x: devPresenter.x, z: devPresenter.z, height: 0 };
    else if (!devMode && speakerId && room) {
      const p = room.state.players.get(speakerId);
      if (p) anchor = { x: p.x, z: p.z, height: 0 };
    }
    g.visible = anchor !== null;
    if (anchor) g.position.set(anchor.x, anchor.height, anchor.z);
    hype.current = Math.max(0, hype.current - HYPE_DECAY_PER_SECOND * delta);
    const h = hype.current;
    const t = performance.now() / 1000;
    if (light.current) {
      light.current.intensity = 18 + h * 70 + Math.sin(t * 6) * h * 8;
      light.current.angle = 0.42 + h * 0.18;
    }
    if (ring.current) {
      const s = 1.2 + h * 1.6 + Math.sin(t * 5) * 0.06 * (0.3 + h);
      ring.current.scale.set(s, s, 1);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + h * 0.5;
    }
    for (let i = drops.current.length - 1; i >= 0; i--) {
      const d = drops.current[i]!;
      d.age += delta;
      d.velocity.y -= 14 * delta;
      d.mesh.position.addScaledVector(d.velocity, delta);
      if (d.mesh.position.y < 0.04) {
        d.mesh.position.y = 0.04;
        d.velocity.multiplyScalar(0.2);
        d.mesh.scale.y = Math.max(0.02, d.mesh.scale.y * 0.6);
      }
      (d.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - d.age / d.life);
      if (d.age >= d.life) {
        g.remove(d.mesh);
        (d.mesh.material as THREE.Material).dispose();
        drops.current.splice(i, 1);
      }
    }
    const call = HYPE_CALLS.find((c) => h >= c.at)?.text ?? "";
    if (call !== hypeCall) setHypeCall(call);
  });

  if (!active) return null;
  return (
    <group ref={group}>
      <spotLight
        ref={light}
        position={[0, 7, 0]}
        angle={0.45}
        penumbra={0.6}
        distance={14}
        color="#fff3c4"
        intensity={18}
        castShadow={false}
      />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.9, 1.15, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <Html position={[0, 2.6, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="speaker-bubble">
          <span>発表中🎤</span>
          {hypeCall && <strong key={hypeCall}>{hypeCall}</strong>}
        </div>
      </Html>
      {callouts.map((c, index) => (
        <Html
          key={c.id}
          position={[((index % 3) - 1) * 1.3, 3.4 + (index % 2) * 0.5, 0]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="speaker-callout" style={{ background: c.color }}>
            {c.text}
          </div>
        </Html>
      ))}
    </group>
  );
}
