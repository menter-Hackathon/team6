import { PLAYER_SIZE, type PlayerAccessory } from "@gaya/shared";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type Ref, type RefObject } from "react";
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  type Group,
  type Vector3Tuple,
} from "three";
import { Bead, ExtraAccessory } from "./player-extra-accessories";

const SIDES = [-1, 1] as const;
const FRONT = 0.5;
const DARK = "#1c1827";
const CREAM = "#fff7e6";

export function PlayerCube({
  color,
  accessory = "none",
  bodyRef,
  jumpTime,
}: {
  color: string;
  accessory?: PlayerAccessory;
  bodyRef?: Ref<Mesh>;
  jumpTime?: RefObject<number> | undefined;
}) {
  return (
    <mesh
      ref={bodyRef ?? null}
      castShadow
      receiveShadow
      position-y={PLAYER_SIZE / 2}
    >
      <boxGeometry args={[PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE]} />
      <meshStandardMaterial
        color={color}
        roughness={accessory === "toaster" ? 0.3 : 0.45}
        metalness={accessory === "toaster" ? 0.18 : 0.1}
      />
      {accessory !== "none" && (
        <group scale={PLAYER_SIZE}>
          <Accessory accessory={accessory} jumpTime={jumpTime} />
        </group>
      )}
    </mesh>
  );
}

function Accessory({
  accessory,
  jumpTime,
}: {
  accessory: Exclude<PlayerAccessory, "none">;
  jumpTime: RefObject<number> | undefined;
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
      return <CatEars />;
    case "rabbit-ears":
      return <RabbitEars />;
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
    default:
      return <ExtraAccessory accessory={accessory} jumpTime={jumpTime} />;
  }
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

const CAT_EAR_OUTLINE = new Shape();
CAT_EAR_OUTLINE.moveTo(-0.17, 0);
CAT_EAR_OUTLINE.quadraticCurveTo(-0.13, 0.15, 0.027, 0.355);
CAT_EAR_OUTLINE.quadraticCurveTo(0.073, 0.414, 0.096, 0.355);
CAT_EAR_OUTLINE.quadraticCurveTo(0.149, 0.224, 0.175, 0.027);
CAT_EAR_OUTLINE.quadraticCurveTo(0.027, -0.031, -0.17, 0);
CAT_EAR_OUTLINE.closePath();

const CAT_EAR_SHELL = {
  depth: 0.115,
  bevelThickness: 0.022,
  bevelSize: 0.02,
  bevelSegments: 3,
  curveSegments: 12,
};
const CAT_EAR_INNER = {
  ...CAT_EAR_SHELL,
  depth: 0.011,
  bevelThickness: 0.008,
  bevelSize: 0.008,
};

function CatEars() {
  return SIDES.map((side) => (
    <group
      key={side}
      position={[side * 0.3, 0.49, 0.15]}
      rotation-y={side * 0.12}
      scale-x={side}
    >
      <mesh>
        <extrudeGeometry args={[CAT_EAR_OUTLINE, CAT_EAR_SHELL]} />
        <meshStandardMaterial color="#342438" roughness={0.84} />
      </mesh>
      <mesh position={[0.008, 0.043, 0.127]} scale={[0.65, 0.69, 1]}>
        <extrudeGeometry args={[CAT_EAR_OUTLINE, CAT_EAR_INNER]} />
        <meshStandardMaterial color="#ff8aab" roughness={0.88} />
      </mesh>
    </group>
  ));
}

function RabbitEars() {
  return SIDES.map((side) => (
    <group
      key={side}
      position={[side * 0.29, 0.47, 0.012]}
      rotation-z={-side * 0.17}
    >
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
    </group>
  ));
}

const TRACK_HEIGHT = 0.33;
const TRACK_WIDTH = 0.235;
const TRACK_BEVEL = 0.015;
const TRACK_END_CENTER = (1.13 - TRACK_HEIGHT) / 2;
const TRACK_END_RADIUS = TRACK_HEIGHT / 2 - TRACK_BEVEL;
const TRACK_OUTLINE = new Shape();
TRACK_OUTLINE.moveTo(-TRACK_END_CENTER, -TRACK_END_RADIUS);
TRACK_OUTLINE.absarc(
  TRACK_END_CENTER,
  0,
  TRACK_END_RADIUS,
  -Math.PI / 2,
  Math.PI / 2,
);
TRACK_OUTLINE.absarc(
  -TRACK_END_CENTER,
  0,
  TRACK_END_RADIUS,
  Math.PI / 2,
  Math.PI * 1.5,
);
TRACK_OUTLINE.closePath();
const TRACK_BELT = {
  depth: TRACK_WIDTH - TRACK_BEVEL * 2,
  bevelSize: TRACK_BEVEL,
  bevelThickness: TRACK_BEVEL,
  bevelSegments: 3,
  curveSegments: 12,
};

function Tracks() {
  return SIDES.map((side) => (
    <group key={side} position={[side * 0.575, -0.5 + TRACK_HEIGHT / 2, 0]}>
      <mesh
        position-x={-TRACK_WIDTH / 2 + TRACK_BEVEL}
        rotation-y={Math.PI / 2}
      >
        <extrudeGeometry args={[TRACK_OUTLINE, TRACK_BELT]} />
        <meshStandardMaterial color="#242530" roughness={0.9} />
      </mesh>
      {[-0.34, 0, 0.34].map((z) => (
        <group key={z} position-z={z}>
          <mesh position-x={side * 0.122} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.122, 0.122, 0.028, 20]} />
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
        <mesh key={index} position={[0, TRACK_HEIGHT / 2, (index - 4) * 0.106]}>
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
const RGB_PALETTE = [
  "#ff1476",
  "#950dff",
  "#155aff",
  "#00f0ff",
  "#1cff71",
  "#d8ff18",
  "#ffb300",
  "#ff3b14",
].map((hex) => new Color(hex));
const RGB_COLOR_STEPS_PER_SECOND = 8;
const RGB_PULSES_PER_SECOND = 2.5;

function CubeEdges({ animated }: { animated: boolean }) {
  const edges = useRef<Group>(null);
  const motionPreference = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)"),
    [],
  );
  const thickness = animated ? 0.061 : 0.047;
  useFrame(({ clock }) => {
    if (!animated) return;
    const reducedMotion = motionPreference.matches;
    const time = reducedMotion ? 0 : clock.elapsedTime;
    edges.current?.children.forEach((child, index) => {
      if (
        !(child instanceof Mesh) ||
        !(child.material instanceof MeshStandardMaterial)
      )
        return;
      const material = child.material;
      const step = time * RGB_COLOR_STEPS_PER_SECOND + index * 1.7;
      const wholeStep = Math.floor(step);
      material.emissive.lerpColors(
        RGB_PALETTE[wholeStep % RGB_PALETTE.length]!,
        RGB_PALETTE[(wholeStep + 1) % RGB_PALETTE.length]!,
        step - wholeStep,
      );
      material.color.copy(material.emissive).multiplyScalar(0.5);
      const phase = 2 * Math.PI * (time * RGB_PULSES_PER_SECOND + index / 12);
      const pulse = (0.5 + Math.cos(phase) / 2) ** 2;
      material.emissiveIntensity = reducedMotion ? 1.15 : 0.45 + 1.5 * pulse;
    });
  });
  return (
    <group ref={edges}>
      {EDGE_AXES.flatMap(([axisA, axisB], along) =>
        SIDES.flatMap((a) =>
          SIDES.map((b) => {
            const position: Vector3Tuple = [0, 0, 0];
            const dimensions: Vector3Tuple = [thickness, thickness, thickness];
            // The X edges also form the corners, where the other edges end.
            dimensions[along] = 1 + (along === 0 ? thickness : -thickness);
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

const HEADPHONE_BAND = new Shape();
HEADPHONE_BAND.moveTo(-0.625, 0.18);
HEADPHONE_BAND.lineTo(-0.625, 0.42);
HEADPHONE_BAND.quadraticCurveTo(-0.625, 0.65, -0.405, 0.65);
HEADPHONE_BAND.lineTo(0.405, 0.65);
HEADPHONE_BAND.quadraticCurveTo(0.625, 0.65, 0.625, 0.42);
HEADPHONE_BAND.lineTo(0.625, 0.18);
HEADPHONE_BAND.lineTo(0.57, 0.18);
HEADPHONE_BAND.lineTo(0.57, 0.42);
HEADPHONE_BAND.quadraticCurveTo(0.57, 0.59, 0.405, 0.59);
HEADPHONE_BAND.lineTo(-0.405, 0.59);
HEADPHONE_BAND.quadraticCurveTo(-0.57, 0.59, -0.57, 0.42);
HEADPHONE_BAND.lineTo(-0.57, 0.18);
HEADPHONE_BAND.closePath();
const HEADPHONE_BAND_EXTRUSION = {
  depth: 0.19,
  bevelSize: 0.014,
  bevelThickness: 0.014,
  bevelSegments: 3,
  curveSegments: 16,
};

function Headphones() {
  return (
    <>
      <mesh position-z={-HEADPHONE_BAND_EXTRUSION.depth / 2}>
        <extrudeGeometry args={[HEADPHONE_BAND, HEADPHONE_BAND_EXTRUSION]} />
        <meshStandardMaterial color={DARK} roughness={0.56} />
      </mesh>
      <RoundedBox args={[0.69, 0.042, 0.204]} position-y={0.57} radius={0.018}>
        <meshStandardMaterial color="#423852" roughness={0.88} />
      </RoundedBox>
      {SIDES.map((side) => (
        <group key={side} position={[side * 0.5, -0.02, 0]}>
          <RoundedBox
            args={[0.067, 0.42, 0.39]}
            position-x={side * 0.034}
            radius={0.029}
          >
            <meshStandardMaterial color="#41384b" roughness={0.96} />
          </RoundedBox>
          <RoundedBox
            args={[0.14, 0.433, 0.42]}
            position-x={side * 0.119}
            radius={0.061}
          >
            <meshStandardMaterial color="#242035" roughness={0.72} />
          </RoundedBox>
          <RoundedBox
            args={[0.048, 0.34, 0.344]}
            position-x={side * 0.19}
            radius={0.021}
          >
            <meshStandardMaterial
              color="#7effd0"
              roughness={0.42}
              metalness={0.27}
            />
          </RoundedBox>
          <Bead
            position={[side * 0.216, 0, 0]}
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

const MASK_PURPLE = "#492286";
const MASK_PINK = "#ec317d";
const MASK_GOLD = "#ffca66";
const MASK_EYE_X = 0.235;
const MASK_EYE_Y = 0.16;
const MASK_EYE_WIDTH = 0.151;
const MASK_EYE_HEIGHT = 0.082;
const MASK_MOUTH_Y = -0.178;
const MASK_MOUTH_WIDTH = 0.14;
const MASK_MOUTH_HEIGHT = 0.077;
const MASK_FRONT = new Shape();
MASK_FRONT.moveTo(-0.51, 0.45);
MASK_FRONT.quadraticCurveTo(-0.39, 0.51, 0, 0.51);
MASK_FRONT.quadraticCurveTo(0.39, 0.51, 0.51, 0.45);
MASK_FRONT.lineTo(0.52, 0.075);
MASK_FRONT.quadraticCurveTo(0.49, -0.18, 0.35, -0.28);
MASK_FRONT.quadraticCurveTo(0.18, -0.365, 0, -0.365);
MASK_FRONT.quadraticCurveTo(-0.18, -0.365, -0.35, -0.28);
MASK_FRONT.quadraticCurveTo(-0.49, -0.18, -0.52, 0.075);
MASK_FRONT.closePath();
for (const side of SIDES) {
  const opening = new Path();
  opening.absellipse(
    side * MASK_EYE_X,
    MASK_EYE_Y,
    MASK_EYE_WIDTH,
    MASK_EYE_HEIGHT,
    0,
    Math.PI * 2,
    false,
    side * 0.28,
  );
  MASK_FRONT.holes.push(opening);
}
const maskMouthOpening = new Path();
maskMouthOpening.absellipse(
  0,
  MASK_MOUTH_Y,
  MASK_MOUTH_WIDTH,
  MASK_MOUTH_HEIGHT,
  0,
  Math.PI * 2,
);
MASK_FRONT.holes.push(maskMouthOpening);

const MASK_FRONT_EXTRUSION = {
  depth: 0.035,
  bevelThickness: 0.008,
  bevelSize: 0.007,
  bevelSegments: 2,
  curveSegments: 24,
};
const MASK_TRIM_EXTRUSION = {
  depth: 0.012,
  bevelThickness: 0.004,
  bevelSize: 0.004,
  bevelSegments: 2,
};
const MASK_CREST = new Shape();
MASK_CREST.moveTo(-0.041, 0.461);
MASK_CREST.lineTo(0.103, 0.461);
MASK_CREST.lineTo(0.024, 0.353);
MASK_CREST.lineTo(0.085, 0.353);
MASK_CREST.lineTo(-0.072, 0.219);
MASK_CREST.lineTo(-0.028, 0.326);
MASK_CREST.lineTo(-0.113, 0.326);
MASK_CREST.closePath();
const MASK_CHEEK = new Shape();
MASK_CHEEK.moveTo(0.49, 0.079);
MASK_CHEEK.lineTo(0.303, 0.012);
MASK_CHEEK.lineTo(0.194, -0.132);
MASK_CHEEK.lineTo(0.353, -0.075);
MASK_CHEEK.lineTo(0.305, -0.177);
MASK_CHEEK.quadraticCurveTo(0.45, -0.137, 0.49, 0.079);
MASK_CHEEK.closePath();

function MaskBinding({
  position,
  radius,
  tilt = 0,
}: {
  position: Vector3Tuple;
  radius: [number, number];
  tilt?: number;
}) {
  return (
    <mesh
      position={position}
      rotation-z={tilt}
      scale={[radius[0], radius[1], 0.13]}
    >
      <torusGeometry args={[1, 0.088, 8, 32]} />
      <meshStandardMaterial
        color={MASK_GOLD}
        roughness={0.48}
        metalness={0.24}
      />
    </mesh>
  );
}

function WrestlingMask() {
  return (
    <>
      <RoundedBox position-y={0.49} args={[1.06, 0.083, 1.06]} radius={0.035}>
        <meshStandardMaterial color={MASK_PURPLE} roughness={0.83} />
      </RoundedBox>
      <RoundedBox position-y={0.537} args={[0.16, 0.019, 1.045]} radius={0.008}>
        <meshStandardMaterial color={MASK_PINK} roughness={0.8} />
      </RoundedBox>
      <mesh position-z={0.516}>
        <extrudeGeometry args={[MASK_FRONT, MASK_FRONT_EXTRUSION]} />
        <meshStandardMaterial color={MASK_PURPLE} roughness={0.82} />
      </mesh>
      <mesh position-z={0.555}>
        <extrudeGeometry args={[MASK_CREST, MASK_TRIM_EXTRUSION]} />
        <meshStandardMaterial
          color={MASK_GOLD}
          roughness={0.49}
          metalness={0.23}
        />
      </mesh>
      {SIDES.map((side) => (
        <group key={side}>
          <RoundedBox
            position={[side * 0.501, 0.177, 0]}
            args={[0.064, 0.64, 1.05]}
            radius={0.027}
          >
            <meshStandardMaterial color={MASK_PURPLE} roughness={0.83} />
          </RoundedBox>
          <RoundedBox
            position={[side * 0.542, 0.323, 0]}
            args={[0.018, 0.078, 0.76]}
            radius={0.008}
          >
            <meshStandardMaterial color={MASK_PINK} roughness={0.74} />
          </RoundedBox>
          <mesh position-z={0.552} scale-x={side}>
            <extrudeGeometry args={[MASK_CHEEK, MASK_TRIM_EXTRUSION]} />
            <meshStandardMaterial color={MASK_PINK} roughness={0.76} />
          </mesh>
          <MaskBinding
            position={[side * MASK_EYE_X, MASK_EYE_Y, 0.555]}
            radius={[MASK_EYE_WIDTH, MASK_EYE_HEIGHT]}
            tilt={side * 0.28}
          />
          <Bead
            position={[side * MASK_EYE_X, MASK_EYE_Y, 0.513]}
            scale={[0.157, 0.09, 0.016]}
            tilt={side * 0.28}
            color={DARK}
          />
          <Bead
            position={[side * (MASK_EYE_X - 0.019), MASK_EYE_Y, 0.527]}
            scale={[0.095, 0.048, 0.024]}
            tilt={side * 0.28}
            color={CREAM}
          />
          <Bead
            position={[side * (MASK_EYE_X - 0.043), MASK_EYE_Y, 0.548]}
            scale={[0.026, 0.041, 0.009]}
            color={DARK}
          />
        </group>
      ))}
      <MaskBinding
        position={[0, MASK_MOUTH_Y, 0.554]}
        radius={[MASK_MOUTH_WIDTH, MASK_MOUTH_HEIGHT]}
      />
      <Bead
        position={[0, MASK_MOUTH_Y, 0.513]}
        scale={[0.149, 0.086, 0.017]}
        color={DARK}
      />
      <Bead
        position={[0, MASK_MOUTH_Y + 0.025, 0.528]}
        scale={[0.095, 0.026, 0.017]}
        color={CREAM}
      />
      <RoundedBox
        position={[0, 0.163, -0.505]}
        args={[1.045, 0.686, 0.065]}
        radius={0.027}
      >
        <meshStandardMaterial color={MASK_PURPLE} roughness={0.83} />
      </RoundedBox>
      <RoundedBox
        position={[0, 0.147, -0.542]}
        args={[0.18, 0.544, 0.031]}
        radius={0.012}
      >
        <meshStandardMaterial color={DARK} roughness={0.87} />
      </RoundedBox>
      {[-0.048, 0.082, 0.212, 0.342].map((y) => (
        <group key={y}>
          {SIDES.map((side) => (
            <MaskBinding
              key={side}
              position={[side * 0.093, y, -0.558]}
              radius={[0.024, 0.024]}
            />
          ))}
          {y > 0 &&
            SIDES.map((side) => (
              <Bead
                key={side}
                position={[0, y - 0.065, -0.568]}
                scale={[0.115, 0.012, 0.009]}
                tilt={side * 0.61}
                color={CREAM}
              />
            ))}
        </group>
      ))}
    </>
  );
}
