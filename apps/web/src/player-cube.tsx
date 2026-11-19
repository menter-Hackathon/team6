import { PLAYER_SIZE, type PlayerAccessory } from "@gaya/shared";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type Ref } from "react";
import {
  Mesh,
  MeshStandardMaterial,
  type Group,
  type Vector3Tuple,
} from "three";

const SIDES = [-1, 1] as const;
const FRONT = 0.5;
const DARK = "#1c1827";
const CREAM = "#fff7e6";

export function PlayerCube({
  color,
  accessory = "none",
  bodyRef,
}: {
  color: string;
  accessory?: PlayerAccessory;
  bodyRef?: Ref<Mesh>;
}) {
  return (
    <mesh
      ref={bodyRef ?? null}
      castShadow
      receiveShadow
      position-y={PLAYER_SIZE / 2}
    >
      <boxGeometry args={[PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
      {accessory !== "none" && (
        <group scale={PLAYER_SIZE}>
          <Accessory accessory={accessory} />
        </group>
      )}
    </mesh>
  );
}

function Accessory({
  accessory,
}: {
  accessory: Exclude<PlayerAccessory, "none">;
}) {
  switch (accessory) {
    case "sunglasses":
    case "glasses":
      return <Eyewear sunglasses={accessory === "sunglasses"} />;
    case "santa-hat":
      return <SantaHat />;
    case "straw-hat":
    case "cowboy-hat":
      return <BrimmedHat cowboy={accessory === "cowboy-hat"} />;
    case "eyes":
    case "surprised":
      return <Face surprised={accessory === "surprised"} />;
    case "cat-ears":
    case "rabbit-ears":
      return <Ears rabbit={accessory === "rabbit-ears"} />;
    case "tracks":
      return <Tracks />;
    case "color-edges":
    case "rgb-edges":
      return <CubeEdges animated={accessory === "rgb-edges"} />;
    case "siren":
      return <Siren />;
    case "headphones":
      return <Headphones />;
    case "halo":
      return (
        <mesh position={[0, 0.78, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.34, 0.038, 10, 40]} />
          <meshStandardMaterial
            color="#ffdc72"
            metalness={0.5}
            roughness={0.23}
            emissive="#ffb22b"
            emissiveIntensity={0.45}
          />
        </mesh>
      );
    case "wings":
      return <Wings />;
    case "wrestling-mask":
      return <WrestlingMask />;
  }
}

function Bead({
  position,
  scale,
  color,
  tilt = 0,
}: {
  position: Vector3Tuple;
  scale: Vector3Tuple;
  color: string;
  tilt?: number;
}) {
  return (
    <mesh position={position} scale={scale} rotation-z={tilt}>
      <sphereGeometry args={[1, 20, 14]} />
      <meshStandardMaterial color={color} roughness={0.53} />
    </mesh>
  );
}

function Eyewear({ sunglasses }: { sunglasses: boolean }) {
  const frame = sunglasses ? "#1b1526" : "#ffd165";
  return (
    <group position-y={0.1}>
      {SIDES.map((side) => (
        <group key={side}>
          <RoundedBox
            position={[side * 0.235, 0, FRONT + 0.045]}
            args={[0.408, 0.263, 0.105]}
            radius={0.065}
          >
            <meshStandardMaterial
              color={frame}
              metalness={0.35}
              roughness={0.28}
            />
          </RoundedBox>
          <RoundedBox
            position={[side * 0.235, 0, FRONT + 0.098]}
            args={[0.33, 0.187, 0.035]}
            radius={0.046}
          >
            <meshStandardMaterial
              color={sunglasses ? "#282146" : "#afedf8"}
              roughness={sunglasses ? 0.16 : 0.32}
              metalness={sunglasses ? 0.55 : 0.2}
              transparent={!sunglasses}
              opacity={sunglasses ? 1 : 0.74}
            />
          </RoundedBox>
          <Bead
            position={[side * 0.235 - 0.052, 0.045, FRONT + 0.117]}
            scale={[0.051, 0.012, 0.006]}
            color={sunglasses ? "#9c89ca" : CREAM}
            tilt={0.45}
          />
          <RoundedBox
            position={[side * 0.513, 0.054, 0.202]}
            args={[0.047, 0.054, 0.61]}
            radius={0.017}
          >
            <meshStandardMaterial color={frame} roughness={0.32} />
          </RoundedBox>
          <RoundedBox
            position={[side * 0.477, 0.052, 0.524]}
            args={[0.18, 0.053, 0.051]}
            radius={0.015}
          >
            <meshStandardMaterial color={frame} roughness={0.32} />
          </RoundedBox>
        </group>
      ))}
      <Bead
        position={[0, 0.031, FRONT + 0.066]}
        scale={[0.09, 0.027, 0.033]}
        color={frame}
      />
    </group>
  );
}

function SantaHat() {
  return (
    <group position={[0, 0.51, 0]} rotation-z={-0.17}>
      <mesh position={[0, 0.073, 0]}>
        <cylinderGeometry args={[0.45, 0.48, 0.145, 32]} />
        <meshStandardMaterial color={CREAM} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.347, 0]}>
        <coneGeometry args={[0.425, 0.57, 32]} />
        <meshStandardMaterial color="#dc2451" roughness={0.82} />
      </mesh>
      <Bead
        position={[0.09, 0.59, 0]}
        scale={[0.19, 0.155, 0.13]}
        tilt={-0.55}
        color="#dc2451"
      />
      <Bead
        position={[0.251, 0.51, 0.015]}
        scale={[0.119, 0.116, 0.115]}
        color={CREAM}
      />
    </group>
  );
}

function BrimmedHat({ cowboy }: { cowboy: boolean }) {
  const brim = cowboy ? "#925632" : "#eac486";
  const crown = cowboy ? "#ad6b40" : "#f0ce96";
  const band = cowboy ? "#442421" : "#d8384f";
  return (
    <group position-y={0.56}>
      <mesh scale={cowboy ? [1.16, 0.17, 0.96] : [1, 0.105, 1]}>
        <sphereGeometry args={[0.69, 40, 16]} />
        <meshStandardMaterial color={brim} roughness={0.86} />
      </mesh>
      {cowboy &&
        SIDES.map((side) => (
          <Bead
            key={side}
            position={[side * 0.62, 0.055, 0]}
            scale={[0.17, 0.085, 0.45]}
            tilt={side * 0.5}
            color={brim}
          />
        ))}
      <mesh position-y={0.156} scale={cowboy ? [1, 1, 0.84] : [1, 1, 1]}>
        <cylinderGeometry args={[0.35, 0.415, 0.27, 36]} />
        <meshStandardMaterial color={crown} roughness={0.79} />
      </mesh>
      <Bead
        position={[0, 0.28, 0]}
        scale={cowboy ? [0.35, 0.1, 0.29] : [0.354, 0.09, 0.354]}
        color={crown}
      />
      <mesh position-y={0.105} scale={cowboy ? [1, 1, 0.84] : [1, 1, 1]}>
        <cylinderGeometry args={[0.405, 0.423, 0.095, 36]} />
        <meshStandardMaterial color={band} roughness={0.72} />
      </mesh>
      {cowboy ? (
        <mesh position={[0, 0.112, 0.347]} rotation-z={Math.PI / 4}>
          <boxGeometry args={[0.072, 0.072, 0.035]} />
          <meshStandardMaterial
            color="#ffc971"
            metalness={0.62}
            roughness={0.32}
          />
        </mesh>
      ) : (
        [0.49, 0.57, 0.64].map((radius, index) => (
          <mesh
            key={radius}
            position-y={0.054 - index * 0.013}
            rotation-x={Math.PI / 2}
          >
            <torusGeometry args={[radius, 0.009, 6, 48]} />
            <meshStandardMaterial color="#ce9e58" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Face({ surprised }: { surprised: boolean }) {
  return (
    <group>
      {SIDES.map((side) => (
        <group
          key={side}
          position={[side * 0.202, surprised ? 0.169 : 0.1, FRONT]}
        >
          <Bead
            position={[0, 0, 0.019]}
            scale={surprised ? [0.145, 0.17, 0.072] : [0.147, 0.199, 0.068]}
            color={CREAM}
          />
          <Bead
            position={[surprised ? -side * 0.022 : 0.036, -0.015, 0.083]}
            scale={surprised ? [0.055, 0.073, 0.023] : [0.075, 0.114, 0.026]}
            color={DARK}
          />
          <Bead
            position={[0.018, 0.03, 0.107]}
            scale={[0.017, 0.02, 0.008]}
            color="#ffffff"
          />
        </group>
      ))}
      {surprised && (
        <>
          <Bead
            position={[0, -0.206, FRONT + 0.028]}
            scale={[0.117, 0.165, 0.048]}
            color="#331a35"
          />
          <Bead
            position={[0, -0.275, FRONT + 0.066]}
            scale={[0.069, 0.046, 0.012]}
            color="#f6819b"
          />
        </>
      )}
    </group>
  );
}

function Ears({ rabbit }: { rabbit: boolean }) {
  return SIDES.map((side) => (
    <group
      key={side}
      position={[side * 0.29, 0.47, 0.012]}
      rotation-z={-side * (rabbit ? 0.17 : 0.24)}
    >
      {rabbit ? (
        <>
          <Bead
            position={[0, 0.28, 0]}
            scale={[0.136, 0.365, 0.097]}
            color={CREAM}
          />
          <Bead
            position={[0, 0.334, 0.076]}
            scale={[0.068, 0.248, 0.036]}
            color="#fc94bd"
          />
        </>
      ) : (
        <>
          <mesh
            position-y={0.18}
            scale={[0.95, 1, 0.63]}
            rotation-y={Math.PI / 3}
          >
            <coneGeometry args={[0.225, 0.44, 3]} />
            <meshStandardMaterial color="#312639" roughness={0.9} flatShading />
          </mesh>
          <mesh
            position={[0, 0.146, 0.089]}
            scale={[1, 1, 0.39]}
            rotation-y={Math.PI / 3}
          >
            <coneGeometry args={[0.12, 0.252, 3]} />
            <meshStandardMaterial
              color="#ff93b8"
              roughness={0.86}
              flatShading
            />
          </mesh>
        </>
      )}
    </group>
  ));
}

function Tracks() {
  return SIDES.map((side) => (
    <group key={side} position={[side * 0.526, -0.297, 0]}>
      <RoundedBox args={[0.235, 0.382, 1.13]} radius={0.157} smoothness={4}>
        <meshStandardMaterial color="#242530" roughness={0.9} />
      </RoundedBox>
      {[-0.34, 0, 0.34].map((z) => (
        <group key={z} position-z={z}>
          <mesh position-x={side * 0.122} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.139, 0.139, 0.028, 20]} />
            <meshStandardMaterial
              color="#4d5363"
              metalness={0.52}
              roughness={0.42}
            />
          </mesh>
          <mesh position-x={side * 0.143} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.055, 0.055, 0.024, 12]} />
            <meshStandardMaterial
              color="#e7ad55"
              metalness={0.4}
              roughness={0.43}
            />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={index} position={[0, 0.19, (index - 4) * 0.106]}>
          <boxGeometry args={[0.228, 0.024, 0.045]} />
          <meshStandardMaterial color="#474653" roughness={0.92} />
        </mesh>
      ))}
    </group>
  ));
}

const EDGE_AXES: [number, number][] = [
  [1, 2],
  [0, 2],
  [0, 1],
];

function CubeEdges({ animated }: { animated: boolean }) {
  const edges = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!animated) return;
    edges.current?.children.forEach((child, index) => {
      if (
        !(child instanceof Mesh) ||
        !(child.material instanceof MeshStandardMaterial)
      )
        return;
      child.material.color.setHSL(
        (clock.elapsedTime * 0.23 + index / 12) % 1,
        0.92,
        0.57,
      );
      child.material.emissive.copy(child.material.color);
    });
  });
  return (
    <group ref={edges}>
      {EDGE_AXES.flatMap(([axisA, axisB], along) =>
        SIDES.flatMap((a) =>
          SIDES.map((b) => {
            const position: Vector3Tuple = [0, 0, 0];
            const dimensions: Vector3Tuple = [0.047, 0.047, 0.047];
            dimensions[along] = 1.046;
            position[axisA] = a * 0.5;
            position[axisB] = b * 0.5;
            return (
              <mesh key={`${along}-${a}-${b}`} position={position}>
                <boxGeometry args={dimensions} />
                <meshStandardMaterial
                  color="#b8ff39"
                  emissive="#779817"
                  emissiveIntensity={animated ? 0.48 : 0.22}
                  roughness={0.43}
                />
              </mesh>
            );
          }),
        ),
      )}
    </group>
  );
}

function Siren() {
  const reflector = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reflector.current)
      reflector.current.rotation.y = clock.elapsedTime * 1.8;
  });
  return (
    <group position-y={0.52}>
      <mesh>
        <cylinderGeometry args={[0.199, 0.231, 0.085, 28]} />
        <meshStandardMaterial color={DARK} metalness={0.5} roughness={0.38} />
      </mesh>
      <mesh position-y={0.121}>
        <cylinderGeometry args={[0.162, 0.186, 0.17, 28]} />
        <meshStandardMaterial
          color="#fa234e"
          emissive="#ef143a"
          emissiveIntensity={0.37}
          roughness={0.27}
        />
      </mesh>
      <mesh position={[0, 0.204, 0]} scale={[1, 0.33, 1]}>
        <sphereGeometry args={[0.163, 28, 16]} />
        <meshStandardMaterial
          color="#ff3d5c"
          emissive="#eb1432"
          emissiveIntensity={0.32}
          roughness={0.27}
        />
      </mesh>
      <group ref={reflector} position-y={0.15}>
        <Bead
          position={[0, 0, 0.172]}
          scale={[0.064, 0.046, 0.012]}
          color="#ffd0bb"
        />
        <Bead
          position={[0, 0, -0.172]}
          scale={[0.064, 0.046, 0.012]}
          color="#ff7b81"
        />
      </group>
    </group>
  );
}

function Headphones() {
  return (
    <>
      <mesh position-y={0.12}>
        <torusGeometry args={[0.562, 0.058, 12, 36, Math.PI]} />
        <meshStandardMaterial color={DARK} roughness={0.56} />
      </mesh>
      {SIDES.map((side) => (
        <group key={side} position={[side * 0.56, -0.02, 0]}>
          <RoundedBox args={[0.185, 0.433, 0.42]} radius={0.082}>
            <meshStandardMaterial color="#242035" roughness={0.72} />
          </RoundedBox>
          <RoundedBox
            args={[0.082, 0.34, 0.344]}
            position-x={side * 0.107}
            radius={0.038}
          >
            <meshStandardMaterial
              color="#7effd0"
              roughness={0.42}
              metalness={0.27}
            />
          </RoundedBox>
          <Bead
            position={[side * 0.15, 0, 0]}
            scale={[0.015, 0.076, 0.076]}
            color="#23495a"
          />
        </group>
      ))}
    </>
  );
}

function Wings() {
  return SIDES.map((side) => (
    <group
      key={side}
      position={[side * 0.41, 0.12, -0.51]}
      rotation-y={side * -0.18}
    >
      <Bead
        position={[side * 0.235, 0.083, 0]}
        scale={[0.357, 0.19, 0.086]}
        tilt={side * 0.39}
        color="#e1dcfa"
      />
      {Array.from({ length: 5 }, (_, index) => (
        <Bead
          key={index}
          position={[
            side * (0.12 + index * 0.104),
            0.008 + index * 0.055,
            -0.043 - index * 0.021,
          ]}
          scale={[0.073, 0.155 + index * 0.034, 0.049]}
          tilt={-side * (0.46 + index * 0.145)}
          color={index % 2 ? "#ede4fb" : CREAM}
        />
      ))}
    </group>
  ));
}

function WrestlingMask() {
  return (
    <>
      <RoundedBox
        position={[0, 0.21, 0]}
        args={[1.043, 0.61, 1.047]}
        radius={0.085}
        smoothness={4}
      >
        <meshStandardMaterial color="#6730a4" roughness={0.67} />
      </RoundedBox>
      {SIDES.map((side) => (
        <group key={side}>
          <Bead
            position={[side * 0.236, 0.135, FRONT + 0.031]}
            scale={[0.184, 0.129, 0.037]}
            tilt={side * -0.28}
            color="#ffd360"
          />
          <Bead
            position={[side * 0.215, 0.146, FRONT + 0.061]}
            scale={[0.101, 0.061, 0.02]}
            tilt={side * -0.28}
            color="#2d1d3f"
          />
          <Bead
            position={[side * 0.236, 0.153, FRONT + 0.076]}
            scale={[0.046, 0.035, 0.012]}
            color={CREAM}
          />
        </group>
      ))}
      <mesh position={[0, 0.364, FRONT + 0.029]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.117, 0.117, 0.048]} />
        <meshStandardMaterial
          color="#ffcb56"
          metalness={0.35}
          roughness={0.49}
        />
      </mesh>
      {[-0.1, 0.025, 0.15, 0.275].map((y, index) => (
        <mesh
          key={y}
          position={[0, y + 0.049, -FRONT - 0.032]}
          rotation-z={index % 2 ? -0.55 : 0.55}
        >
          <boxGeometry args={[0.158, 0.026, 0.037]} />
          <meshStandardMaterial color="#e9c1fe" roughness={0.75} />
        </mesh>
      ))}
    </>
  );
}
