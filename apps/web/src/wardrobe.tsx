import type { PlayerAccessory } from "@gaya/shared";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { PerspectiveCamera } from "three";
import { InkBlobButton, InkPanelScreen } from "./ink-screen";
import { PlayerCube } from "./player-cube";
import "./wardrobe.css";

const ITEMS = {
  none: { name: "装飾なし", icon: "−", category: "all" },
  sunglasses: { name: "サングラス", icon: "🕶️", category: "face" },
  glasses: { name: "メガネ", icon: "👓", category: "face" },
  eyes: { name: "目の模様", icon: "👀", category: "face" },
  surprised: { name: "驚いた顔", icon: "😲", category: "face" },
  "wrestling-mask": {
    name: "プロレスラーのマスク",
    icon: "🎭",
    category: "face",
  },
  "santa-hat": { name: "サンタ帽", icon: "🎅", category: "head" },
  "straw-hat": { name: "麦わら帽", icon: "👒", category: "head" },
  "cowboy-hat": { name: "カウボーイハット", icon: "🤠", category: "head" },
  "cat-ears": { name: "猫耳", icon: "🐱", category: "head" },
  "rabbit-ears": { name: "うさぎ耳", icon: "🐰", category: "head" },
  siren: { name: "赤色灯", icon: "🚨", category: "head" },
  headphones: { name: "ヘッドホン", icon: "🎧", category: "head" },
  halo: { name: "天使の輪", icon: "😇", category: "head" },
  wings: { name: "鳥の翼", icon: "🪽", category: "body" },
  tracks: { name: "キャタピラ", icon: "⚙️", category: "body" },
  "color-edges": { name: "カラーエッジ", icon: "◇", category: "body" },
  "rgb-edges": { name: "ゲーミングエッジ", icon: "🌈", category: "body" },
  "wind-up-key": { name: "ゼンマイねじ", icon: "🔑", category: "body" },
  "air-horn": { name: "エアホーン", icon: "📣", category: "body" },
  "hiking-backpack": { name: "登山リュック", icon: "🎒", category: "body" },
  pudding: { name: "プリン", icon: "🍮", category: "head" },
  duckling: { name: "アヒルの子", icon: "🐤", category: "head" },
  snorkel: { name: "シュノーケル", icon: "🤿", category: "face" },
  "claw-machine": {
    name: "UFOキャッチャー",
    icon: "🦾",
    category: "head",
  },
  "exhaust-fan": { name: "換気扇", icon: "🌀", category: "body" },
  toaster: { name: "トースター", icon: "🍞", category: "body" },
  randoseru: { name: "ランドセル", icon: "🏫", category: "body" },
  "bamboo-copter": { name: "タケコプター", icon: "🌀", category: "head" },
  hachimaki: { name: "はちまき", icon: "🎌", category: "head" },
} as const satisfies Record<
  PlayerAccessory,
  { name: string; icon: string; category: string }
>;

const CATEGORIES = [
  { id: "all", name: "すべて" },
  { id: "head", name: "ヘッド" },
  { id: "face", name: "フェイス" },
  { id: "body", name: "ボディー" },
] as const;

const ACCESSORIES = Object.keys(ITEMS) as PlayerAccessory[];
const REAR_ACCESSORIES = new Set<PlayerAccessory>([
  "wind-up-key",
  "hiking-backpack",
  "exhaust-fan",
  "randoseru",
]);

function FitPreviewCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || size.height === 0) return;
    camera.zoom = Math.min(1, size.width / (size.height * 0.9));
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);
  return null;
}

export function WardrobeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="wardrobe-entry-button" onClick={onClick}>
      着せ替え <span aria-hidden="true">↗</span>
    </button>
  );
}

export function Wardrobe({
  color,
  equipped,
  onEquip,
  onClose,
}: {
  color: string;
  equipped: PlayerAccessory;
  onEquip: (accessory: PlayerAccessory) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(equipped);
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [turned, setTurned] = useState(() => REAR_ACCESSORIES.has(equipped));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (!pending) return;
    if (equipped === draft) {
      onClose();
      return;
    }
    const timeout = window.setTimeout(() => {
      setError(true);
      setPending(false);
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [draft, equipped, onClose, pending]);

  const equip = () => {
    if (equipped === draft) {
      onClose();
      return;
    }
    setError(false);
    setPending(true);
    onEquip(draft);
  };

  return (
    <dialog
      ref={dialog}
      className="wardrobe"
      aria-label="スキン決定"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <InkPanelScreen
        label="スキン決定"
        title="スキン決定"
        color="green"
        wide
        corner={
          <button
            type="button"
            className="ink-panel-link"
            onClick={onClose}
            disabled={pending}
          >
            ← もどる
          </button>
        }
        blob={
          <InkBlobButton color="blue" onClick={equip} disabled={pending}>
            {pending ? "反映中…" : "準備OK！"}
          </InkBlobButton>
        }
      >
        <div className="wardrobe-layout">
          <section className="wardrobe-stage" aria-label="3Dプレビュー">
            <Canvas
              dpr={[1, 1.75]}
              style={{ position: "absolute", inset: 0 }}
              camera={{ position: [2.55, 2.14, 4.25], fov: 30 }}
              fallback={
                <p className="wardrobe-preview-note">
                  3D表示にはWebGLが必要です。
                </p>
              }
            >
              <FitPreviewCamera />
              <ambientLight intensity={1.18} />
              <directionalLight
                position={[3, 5, 4]}
                intensity={2.4}
                color="#fff4db"
              />
              <directionalLight
                position={[-4, 2, -3]}
                intensity={1.6}
                color="#73f3ee"
              />
              <group
                rotation-y={turned ? Math.PI : 0}
                position-y={draft === "claw-machine" ? 0.12 : 0}
              >
                <PlayerCube color={color} accessory={draft} />
              </group>
              <mesh position-y={-0.028}>
                <cylinderGeometry args={[1.07, 1.11, 0.055, 64]} />
                <meshStandardMaterial color="#222637" roughness={0.62} />
              </mesh>
              <mesh position-y={-0.058}>
                <cylinderGeometry args={[1.13, 1.12, 0.048, 64]} />
                <meshStandardMaterial
                  color="#a9f83a"
                  emissive="#71bd23"
                  emissiveIntensity={0.38}
                />
              </mesh>
              <OrbitControls
                target={[0, 0.62, 0]}
                enablePan={false}
                enableZoom={false}
                minPolarAngle={0.55}
                maxPolarAngle={1.55}
              />
            </Canvas>
            <div className="wardrobe-stage-footer">
              <span>ドラッグで回転</span>
              <button type="button" onClick={() => setTurned((value) => !value)}>
                <span aria-hidden="true">↻</span> 180°
              </button>
            </div>
          </section>

          <section className="wardrobe-picker" aria-label="装飾の選択">
            <div
              className="wardrobe-filters"
              role="group"
              aria-label="部位で絞り込む"
            >
              {CATEGORIES.map(({ id, name }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                >
                  <span>{name}</span>
                </button>
              ))}
            </div>
            <div className="wardrobe-items">
              {ACCESSORIES.filter(
                (id) =>
                  id === "none" ||
                  category === "all" ||
                  ITEMS[id].category === category,
              ).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="wardrobe-item"
                  aria-pressed={draft === id}
                  onClick={() => {
                    if (draft !== id) setTurned(REAR_ACCESSORIES.has(id));
                    setDraft(id);
                    setError(false);
                  }}
                  disabled={pending}
                >
                  <span className="wardrobe-item-icon" aria-hidden="true">
                    {ITEMS[id].icon}
                  </span>
                  <span className="wardrobe-item-name">{ITEMS[id].name}</span>
                  {equipped === id && (
                    <span className="wardrobe-equipped">装着中</span>
                  )}
                </button>
              ))}
            </div>
            <p className="wardrobe-status" role={error ? "alert" : undefined}>
              {error
                ? "反映を確認できませんでした。もう一度お試しください。"
                : `プレビュー中：${ITEMS[draft].name}`}
            </p>
          </section>
        </div>
      </InkPanelScreen>
    </dialog>
  );
}
