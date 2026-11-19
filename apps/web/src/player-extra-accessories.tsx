import { JUMP_DURATION, type PlayerAccessory } from "@gaya/shared";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  Path,
  Shape,
  Vector2,
  Vector3,
  type Group,
  type Vector3Tuple,
} from "three";

const SIDES = [-1, 1] as const;
const DARK = "#24232d";
const GOLD = "#ffbc57";
const QUARTER_TURN = Math.PI / 2;

export function ExtraAccessory({
  accessory,
  jumpTime,
}: {
  accessory: Extract<
    PlayerAccessory,
    | "wind-up-key"
    | "air-horn"
    | "hiking-backpack"
    | "pudding"
    | "duckling"
    | "snorkel"
    | "claw-machine"
    | "exhaust-fan"
    | "toaster"
    | "randoseru"
    | "bamboo-copter"
    | "hachimaki"
  >;
  jumpTime: RefObject<number> | undefined;
}) {
  switch (accessory) {
    case "wind-up-key":
      return <WindUpKey />;
    case "air-horn":
      return <AirHorn />;
    case "hiking-backpack":
      return <HikingBackpack />;
    case "pudding":
      return <Pudding jumpTime={jumpTime} />;
    case "duckling":
      return <Duckling />;
    case "snorkel":
      return <Snorkel />;
    case "claw-machine":
      return <ClawMachine />;
    case "exhaust-fan":
      return <ExhaustFan />;
    case "toaster":
      return <Toaster jumpTime={jumpTime} />;
    case "randoseru":
      return <Randoseru />;
    case "bamboo-copter":
      return <BambooCopter />;
    case "hachimaki":
      return <Hachimaki />;
  }
}

export function Bead({
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

function useMotionPreference() {
  return useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)"),
    [],
  );
}

function previewJumpTime(elapsedTime: number) {
  const age = (elapsedTime % 3) - 1;
  return age >= 0 && age < JUMP_DURATION ? age : -1;
}

function WindUpKey() {
  const key = useRef<Group>(null);
  const motion = useMotionPreference();
  useFrame((_, delta) => {
    if (key.current && !motion.matches) key.current.rotation.z -= delta * 2.6;
  });
  return (
    <group position={[0, 0.04, -0.5]} rotation-y={Math.PI}>
      <mesh position-z={0.026} rotation-x={QUARTER_TURN}>
        <cylinderGeometry args={[0.18, 0.18, 0.084, 28]} />
        <meshStandardMaterial
          color="#594938"
          roughness={0.43}
          metalness={0.4}
        />
      </mesh>
      <mesh position-z={0.114} rotation-x={QUARTER_TURN}>
        <cylinderGeometry args={[0.067, 0.067, 0.17, 20]} />
        <meshStandardMaterial
          color="#b37739"
          roughness={0.28}
          metalness={0.45}
        />
      </mesh>
      <group ref={key} position-z={0.22}>
        <RoundedBox args={[0.37, 0.094, 0.082]} radius={0.025}>
          <meshStandardMaterial
            color={GOLD}
            roughness={0.31}
            metalness={0.55}
          />
        </RoundedBox>
        {SIDES.map((side) => (
          <mesh key={side} position-x={side * 0.17} scale={[1, 0.86, 1]}>
            <torusGeometry args={[0.108, 0.032, 10, 26]} />
            <meshStandardMaterial
              color={GOLD}
              roughness={0.32}
              metalness={0.46}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const HORN_PROFILE = [
  [0.034, 0],
  [0.05, 0.035],
  [0.057, 0.15],
  [0.085, 0.24],
  [0.143, 0.325],
  [0.146, 0.348],
  [0.119, 0.348],
  [0.115, 0.329],
  [0.063, 0.249],
  [0.041, 0.155],
  [0.032, 0.041],
  [0.034, 0],
].map(([radius, height]) => new Vector2(radius, height));

function AirHorn() {
  return (
    <group position={[0.575, 0.015, 0.1]} rotation-z={-0.19}>
      <RoundedBox args={[0.15, 0.13, 0.19]} position-x={-0.09} radius={0.024}>
        <meshStandardMaterial color={DARK} roughness={0.71} />
      </RoundedBox>
      <mesh>
        <cylinderGeometry args={[0.112, 0.112, 0.392, 28]} />
        <meshStandardMaterial
          color="#dcf5f7"
          metalness={0.32}
          roughness={0.36}
        />
      </mesh>
      <mesh position-y={-0.027}>
        <cylinderGeometry args={[0.114, 0.114, 0.19, 28]} />
        <meshStandardMaterial color="#1a81b2" roughness={0.45} />
      </mesh>
      <mesh position-y={0.203}>
        <cylinderGeometry args={[0.088, 0.11, 0.063, 28]} />
        <meshStandardMaterial color="#ba293a" roughness={0.4} />
      </mesh>
      <group position={[0, 0.236, 0.004]} rotation-x={QUARTER_TURN - 0.17}>
        <mesh>
          <latheGeometry args={[HORN_PROFILE, 32]} />
          <meshStandardMaterial
            color="#f8404e"
            roughness={0.32}
            side={DoubleSide}
          />
        </mesh>
        <mesh position-y={0.302} rotation-x={QUARTER_TURN}>
          <torusGeometry args={[0.125, 0.012, 8, 30]} />
          <meshStandardMaterial color="#ff7874" roughness={0.38} />
        </mesh>
        <mesh position-y={0.062}>
          <cylinderGeometry args={[0.035, 0.033, 0.021, 20]} />
          <meshStandardMaterial color="#731f39" roughness={0.93} />
        </mesh>
      </group>
    </group>
  );
}

function HikingBackpack() {
  return (
    <group position={[0, -0.012, -0.635]}>
      <RoundedBox args={[0.71, 0.78, 0.37]} radius={0.115}>
        <meshStandardMaterial color="#30564f" roughness={0.92} />
      </RoundedBox>
      <RoundedBox
        args={[0.55, 0.43, 0.17]}
        position={[0, -0.12, -0.195]}
        radius={0.071}
      >
        <meshStandardMaterial color="#478477" roughness={0.84} />
      </RoundedBox>
      <RoundedBox
        args={[0.61, 0.16, 0.23]}
        position={[0, 0.282, -0.115]}
        radius={0.065}
      >
        <meshStandardMaterial color="#d7a45c" roughness={0.86} />
      </RoundedBox>
      <mesh position={[0, 0.401, -0.013]} rotation-z={QUARTER_TURN}>
        <cylinderGeometry args={[0.118, 0.118, 0.754, 28]} />
        <meshStandardMaterial color="#a86a48" roughness={0.86} />
      </mesh>
      {SIDES.map((side) => (
        <group key={side} position-x={side * 0.202}>
          <mesh position={[0, 0.401, -0.013]} rotation-z={QUARTER_TURN}>
            <cylinderGeometry args={[0.121, 0.121, 0.045, 26]} />
            <meshStandardMaterial color="#373a34" roughness={0.89} />
          </mesh>
          <RoundedBox
            args={[0.051, 0.5, 0.035]}
            position={[0, 0.008, -0.272]}
            radius={0.014}
          >
            <meshStandardMaterial color="#e1b572" roughness={0.78} />
          </RoundedBox>
          <RoundedBox
            args={[0.087, 0.077, 0.037]}
            position={[0, 0.111, -0.291]}
            radius={0.012}
          >
            <meshStandardMaterial
              color="#283f3c"
              metalness={0.22}
              roughness={0.62}
            />
          </RoundedBox>
        </group>
      ))}
      <mesh position={[0.374, -0.123, -0.056]}>
        <cylinderGeometry args={[0.064, 0.082, 0.24, 16]} />
        <meshStandardMaterial color="#6dc4be" roughness={0.44} />
      </mesh>
    </group>
  );
}

const PUDDING_PROFILE = [
  [0, 0],
  [0.248, 0],
  [0.27, 0.018],
  [0.269, 0.035],
  [0.227, 0.2],
  [0.207, 0.248],
  [0.19, 0.282],
  [0.159, 0.293],
  [0, 0.294],
].map(([radius, height]) => new Vector2(radius, height));

const CARAMEL_PROFILE = [
  [0.212, 0.235],
  [0.207, 0.25],
  [0.194, 0.278],
  [0.169, 0.297],
  [0.117, 0.303],
  [0, 0.306],
].map(([radius, height]) => new Vector2(radius, height));

function Pudding({ jumpTime }: { jumpTime: RefObject<number> | undefined }) {
  const pudding = useRef<Group>(null);
  const wasAirborne = useRef(false);
  const landingAge = useRef(1);
  const motion = useMotionPreference();
  useFrame(({ clock }, delta) => {
    const model = pudding.current;
    if (!model) return;
    const airborne =
      (jumpTime?.current ?? previewJumpTime(clock.elapsedTime)) >= 0;
    if (wasAirborne.current && !airborne) landingAge.current = 0;
    wasAirborne.current = airborne;
    landingAge.current = Math.min(1, landingAge.current + delta);
    const age = landingAge.current;
    const wobble = motion.matches
      ? 0
      : -Math.cos(age * 24) * Math.exp(-age * 7) * 0.19;
    model.scale.set(1 - wobble * 0.43, 1 + wobble, 1 - wobble * 0.43);
    model.rotation.z = motion.matches
      ? 0
      : Math.sin(age * 21) * Math.exp(-age * 7) * 0.11;
  });
  return (
    <group position-y={0.527}>
      <mesh position-y={-0.013}>
        <cylinderGeometry args={[0.338, 0.29, 0.046, 36]} />
        <meshStandardMaterial color="#d6eced" roughness={0.39} />
      </mesh>
      <mesh rotation-x={QUARTER_TURN} position-y={0.012}>
        <torusGeometry args={[0.294, 0.016, 8, 36]} />
        <meshStandardMaterial color="#9dafd1" roughness={0.46} />
      </mesh>
      <group ref={pudding} position-y={0.011}>
        <mesh>
          <latheGeometry args={[PUDDING_PROFILE, 40]} />
          <meshStandardMaterial color="#f6c65d" roughness={0.29} />
        </mesh>
        <mesh>
          <latheGeometry args={[CARAMEL_PROFILE, 40]} />
          <meshStandardMaterial color="#a84320" roughness={0.23} />
        </mesh>
        <Bead
          position={[0.109, 0.247, 0.174]}
          scale={[0.048, 0.061, 0.026]}
          color="#a84320"
          tilt={0.24}
        />
        <Bead
          position={[-0.069, 0.258, 0.184]}
          scale={[0.034, 0.04, 0.023]}
          color="#a84320"
        />
      </group>
    </group>
  );
}

function Duckling() {
  return (
    <group position={[0, 0.506, 0.025]} rotation-y={0.16}>
      <Bead
        position={[0, 0.134, -0.046]}
        scale={[0.239, 0.149, 0.243]}
        color="#ffca38"
      />
      <Bead
        position={[0, 0.281, 0.086]}
        scale={[0.153, 0.142, 0.148]}
        color="#ffe160"
      />
      <Bead
        position={[0, 0.219, 0.217]}
        scale={[0.098, 0.043, 0.077]}
        color="#ff903d"
      />
      <Bead
        position={[0, 0.164, -0.236]}
        scale={[0.096, 0.081, 0.072]}
        color="#ffda56"
      />
      {SIDES.map((side) => (
        <group key={side}>
          <Bead
            position={[side * 0.192, 0.139, -0.043]}
            scale={[0.058, 0.078, 0.146]}
            color="#efac32"
            tilt={-side * 0.17}
          />
          <Bead
            position={[side * 0.102, 0.294, 0.18]}
            scale={[0.024, 0.034, 0.024]}
            color="#352631"
          />
          <Bead
            position={[side * 0.108, 0.305, 0.197]}
            scale={[0.009, 0.01, 0.007]}
            color="#fff3e3"
          />
          <Bead
            position={[side * 0.102, 0.016, 0.09]}
            scale={[0.072, 0.022, 0.084]}
            color="#ff8834"
          />
        </group>
      ))}
    </group>
  );
}

const SNORKEL_TUBE = new CatmullRomCurve3([
  new Vector3(0.26, -0.192, 0.535),
  new Vector3(0.449, -0.222, 0.54),
  new Vector3(0.557, -0.13, 0.463),
  new Vector3(0.58, 0.175, 0.375),
  new Vector3(0.575, 0.49, 0.286),
  new Vector3(0.555, 0.638, 0.275),
]);

function Snorkel() {
  return (
    <>
      <RoundedBox
        args={[1.045, 0.111, 1.045]}
        position-y={0.105}
        radius={0.038}
      >
        <meshStandardMaterial color="#283d59" roughness={0.88} />
      </RoundedBox>
      <RoundedBox
        args={[0.797, 0.344, 0.144]}
        position={[0, 0.11, 0.544]}
        radius={0.067}
      >
        <meshStandardMaterial color="#29cbcf" roughness={0.42} />
      </RoundedBox>
      {SIDES.map((side) => (
        <group key={side} position-x={side * 0.182}>
          <RoundedBox
            args={[0.319, 0.235, 0.056]}
            position={[0, 0.113, 0.626]}
            radius={0.026}
          >
            <meshStandardMaterial
              color="#23658b"
              roughness={0.21}
              metalness={0.36}
            />
          </RoundedBox>
          <Bead
            position={[-0.048, 0.169, 0.656]}
            scale={[0.057, 0.014, 0.007]}
            color="#a4f6f6"
            tilt={0.39}
          />
        </group>
      ))}
      <mesh>
        <tubeGeometry args={[SNORKEL_TUBE, 30, 0.046, 12, false]} />
        <meshStandardMaterial color="#29bfc4" roughness={0.39} />
      </mesh>
      <RoundedBox
        args={[0.16, 0.094, 0.102]}
        position={[0.266, -0.19, 0.536]}
        radius={0.037}
      >
        <meshStandardMaterial color="#23384c" roughness={0.88} />
      </RoundedBox>
      <mesh position={[0.555, 0.651, 0.275]} rotation-z={0.11}>
        <cylinderGeometry args={[0.063, 0.054, 0.122, 22]} />
        <meshStandardMaterial color="#ff884c" roughness={0.49} />
      </mesh>
      <mesh position={[0.547, 0.713, 0.275]}>
        <cylinderGeometry args={[0.039, 0.039, 0.01, 18]} />
        <meshStandardMaterial color="#2c3c4c" roughness={0.75} />
      </mesh>
    </>
  );
}

const CLAW_TIP_Y = 0.07;
const CLAW_DEPTH = {
  depth: 0.072,
  bevelSize: 0.014,
  bevelThickness: 0.013,
  bevelSegments: 3,
  curveSegments: 10,
};

const CLAW_FINGERS = [Math.PI, Math.PI / 3, -Math.PI / 3].map((angle) => {
  const x = Math.sin(angle);
  const z = Math.cos(angle);
  const side = Math.abs(x) > Math.abs(z);
  const contact = 0.5 / Math.max(Math.abs(x), Math.abs(z));
  const profile = new Shape();
  profile.moveTo(0.103, 0.847);
  profile.quadraticCurveTo(0.32, 0.823, contact + 0.09, 0.569);
  profile.quadraticCurveTo(contact + 0.153, 0.44, contact + 0.131, 0.245);
  profile.quadraticCurveTo(contact + 0.124, 0.098, contact + 0.047, CLAW_TIP_Y);
  profile.lineTo(contact + 0.029, 0.147);
  profile.quadraticCurveTo(contact + 0.094, 0.255, contact + 0.054, 0.493);
  profile.quadraticCurveTo(0.438, 0.663, 0.091, 0.77);
  profile.closePath();
  return {
    angle,
    profile,
    padPosition: [
      x * contact + (side ? Math.sign(x) * 0.029 : 0),
      CLAW_TIP_Y,
      z * contact + (side ? 0 : Math.sign(z) * 0.029),
    ] as Vector3Tuple,
    padYaw: side ? QUARTER_TURN : 0,
  };
});

function ClawMachine() {
  return (
    <>
      <mesh position-y={1.048}>
        <cylinderGeometry args={[0.025, 0.025, 0.242, 16]} />
        <meshStandardMaterial
          color="#302b3b"
          metalness={0.36}
          roughness={0.58}
        />
      </mesh>
      <mesh position-y={1.152}>
        <cylinderGeometry args={[0.067, 0.067, 0.061, 22]} />
        <meshStandardMaterial
          color="#77718e"
          metalness={0.36}
          roughness={0.5}
        />
      </mesh>
      <mesh position-y={0.928}>
        <cylinderGeometry args={[0.071, 0.186, 0.128, 28]} />
        <meshStandardMaterial
          color="#f6ba57"
          metalness={0.36}
          roughness={0.41}
        />
      </mesh>
      <mesh position-y={0.852}>
        <cylinderGeometry args={[0.182, 0.175, 0.058, 28]} />
        <meshStandardMaterial
          color="#4c4159"
          metalness={0.34}
          roughness={0.57}
        />
      </mesh>
      {CLAW_FINGERS.map(({ angle, profile, padPosition, padYaw }) => (
        <group key={angle}>
          <group rotation-y={angle}>
            <mesh position-x={CLAW_DEPTH.depth / 2} rotation-y={-QUARTER_TURN}>
              <extrudeGeometry args={[profile, CLAW_DEPTH]} />
              <meshStandardMaterial
                color="#dbd9e7"
                metalness={0.52}
                roughness={0.36}
              />
            </mesh>
            <mesh position={[0, 0.812, 0.145]} rotation-z={QUARTER_TURN}>
              <cylinderGeometry args={[0.049, 0.049, 0.109, 18]} />
              <meshStandardMaterial
                color="#84768a"
                metalness={0.46}
                roughness={0.46}
              />
            </mesh>
          </group>
          <RoundedBox
            args={[0.114, 0.115, 0.058]}
            position={padPosition}
            rotation-y={padYaw}
            radius={0.024}
          >
            <meshStandardMaterial color="#f1aa43" roughness={0.72} />
          </RoundedBox>
        </group>
      ))}
    </>
  );
}

const FAN_BLADE = new Shape();
FAN_BLADE.moveTo(0.015, 0.035);
FAN_BLADE.quadraticCurveTo(-0.012, 0.135, 0.041, 0.215);
FAN_BLADE.quadraticCurveTo(0.095, 0.225, 0.121, 0.182);
FAN_BLADE.quadraticCurveTo(0.111, 0.099, 0.06, 0.045);
FAN_BLADE.closePath();
const FAN_BLADE_DEPTH = {
  depth: 0.018,
  bevelSize: 0.007,
  bevelThickness: 0.007,
  bevelSegments: 2,
};

function ExhaustFan() {
  const rotor = useRef<Group>(null);
  const motion = useMotionPreference();
  useFrame((_, delta) => {
    if (rotor.current && !motion.matches) rotor.current.rotation.z -= delta * 8;
  });
  return (
    <group position={[0, 0.058, -0.538]} rotation-y={Math.PI}>
      <RoundedBox args={[0.699, 0.699, 0.15]} position-z={0.031} radius={0.06}>
        <meshStandardMaterial color="#d7dfda" roughness={0.66} />
      </RoundedBox>
      <mesh position-z={0.103} rotation-x={QUARTER_TURN}>
        <cylinderGeometry args={[0.27, 0.27, 0.026, 36]} />
        <meshStandardMaterial color="#26343c" roughness={0.81} />
      </mesh>
      <group ref={rotor} position-z={0.143}>
        {[0, 1, 2, 3].map((index) => (
          <mesh key={index} rotation-z={index * QUARTER_TURN}>
            <extrudeGeometry args={[FAN_BLADE, FAN_BLADE_DEPTH]} />
            <meshStandardMaterial
              color="#5dbbab"
              roughness={0.43}
              metalness={0.18}
            />
          </mesh>
        ))}
        <mesh position-z={0.017} rotation-x={QUARTER_TURN}>
          <cylinderGeometry args={[0.058, 0.074, 0.059, 20]} />
          <meshStandardMaterial
            color="#a4ded2"
            metalness={0.27}
            roughness={0.43}
          />
        </mesh>
      </group>
      {[0.125, 0.192, 0.255].map((radius) => (
        <mesh key={radius} position-z={0.182}>
          <torusGeometry args={[radius, 0.011, 8, 36]} />
          <meshStandardMaterial
            color="#aabbb9"
            metalness={0.39}
            roughness={0.55}
          />
        </mesh>
      ))}
      {[Math.PI / 4, (3 * Math.PI) / 4].map((angle) => (
        <mesh key={angle} position-z={0.182} rotation-z={angle}>
          <boxGeometry args={[0.57, 0.015, 0.018]} />
          <meshStandardMaterial
            color="#aabbb9"
            metalness={0.39}
            roughness={0.55}
          />
        </mesh>
      ))}
      {SIDES.flatMap((x) =>
        SIDES.map((y) => (
          <Bead
            key={`${x}-${y}`}
            position={[x * 0.286, y * 0.286, 0.105]}
            scale={[0.025, 0.025, 0.012]}
            color="#7a8988"
          />
        )),
      )}
    </group>
  );
}

const TOAST_SLICE = new Shape();
TOAST_SLICE.moveTo(-0.326, -0.205);
TOAST_SLICE.lineTo(0.326, -0.205);
TOAST_SLICE.quadraticCurveTo(0.374, -0.205, 0.381, -0.161);
TOAST_SLICE.lineTo(0.392, 0.095);
TOAST_SLICE.bezierCurveTo(0.395, 0.185, 0.295, 0.234, 0, 0.234);
TOAST_SLICE.bezierCurveTo(-0.295, 0.234, -0.395, 0.185, -0.392, 0.095);
TOAST_SLICE.lineTo(-0.381, -0.161);
TOAST_SLICE.quadraticCurveTo(-0.374, -0.205, -0.326, -0.205);
TOAST_SLICE.closePath();
const TOAST_CRUST = {
  depth: 0.048,
  bevelSize: 0.013,
  bevelThickness: 0.01,
  bevelSegments: 3,
};
const TOAST_INSIDE = {
  depth: 0.008,
  bevelSize: 0.006,
  bevelThickness: 0.005,
  bevelSegments: 2,
};

const TOASTER_STEEL = "#c6d4dc";
const TOASTER_BREAD_REST = 0.6;
const TOASTER_SLOT_WIDTH = 0.898;
const TOASTER_SLOT_END_RADIUS = 0.075;
const TOASTER_SLOT_Z = [-0.11, 0.11] as const;
const TOASTER_TOP = new Shape();
TOASTER_TOP.moveTo(-0.418, -0.489);
TOASTER_TOP.lineTo(0.418, -0.489);
TOASTER_TOP.quadraticCurveTo(0.489, -0.489, 0.489, -0.418);
TOASTER_TOP.lineTo(0.489, 0.418);
TOASTER_TOP.quadraticCurveTo(0.489, 0.489, 0.418, 0.489);
TOASTER_TOP.lineTo(-0.418, 0.489);
TOASTER_TOP.quadraticCurveTo(-0.489, 0.489, -0.489, 0.418);
TOASTER_TOP.lineTo(-0.489, -0.418);
TOASTER_TOP.quadraticCurveTo(-0.489, -0.489, -0.418, -0.489);
TOASTER_TOP.closePath();
for (const z of TOASTER_SLOT_Z) {
  const slot = new Path();
  const endCenter = TOASTER_SLOT_WIDTH / 2 - TOASTER_SLOT_END_RADIUS;
  slot.moveTo(-endCenter, -z - TOASTER_SLOT_END_RADIUS);
  slot.absarc(
    endCenter,
    -z,
    TOASTER_SLOT_END_RADIUS,
    -QUARTER_TURN,
    QUARTER_TURN,
  );
  slot.absarc(
    -endCenter,
    -z,
    TOASTER_SLOT_END_RADIUS,
    QUARTER_TURN,
    3 * QUARTER_TURN,
  );
  slot.closePath();
  TOASTER_TOP.holes.push(slot);
}
const TOASTER_TOP_EXTRUSION = {
  depth: 0.032,
  bevelSize: 0.006,
  bevelThickness: 0.008,
  bevelSegments: 3,
  curveSegments: 20,
};

function Toaster({ jumpTime }: { jumpTime: RefObject<number> | undefined }) {
  const bread = useRef<Group>(null);
  const motion = useMotionPreference();
  useFrame(({ clock }, delta) => {
    if (!bread.current) return;
    const age = jumpTime?.current ?? previewJumpTime(clock.elapsedTime);
    const pop =
      motion.matches || age < 0 ? 0 : Math.sin((Math.PI * age) / JUMP_DURATION);
    bread.current.position.y +=
      (TOASTER_BREAD_REST + pop * 0.225 - bread.current.position.y) *
      Math.min(1, delta * 19);
    bread.current.rotation.z = pop * 0.09;
  });

  return (
    <>
      <mesh position-y={0.504} rotation-x={-QUARTER_TURN}>
        <extrudeGeometry args={[TOASTER_TOP, TOASTER_TOP_EXTRUSION]} />
        <meshStandardMaterial
          color={TOASTER_STEEL}
          roughness={0.34}
          metalness={0.49}
        />
      </mesh>
      {TOASTER_SLOT_Z.map((z) => (
        <RoundedBox
          key={z}
          args={[
            TOASTER_SLOT_WIDTH + 0.018,
            0.021,
            2 * TOASTER_SLOT_END_RADIUS + 0.017,
          ]}
          position={[0, 0.5, z]}
          radius={0.009}
        >
          <meshStandardMaterial color="#282735" roughness={0.78} />
        </RoundedBox>
      ))}
      <RoundedBox
        args={[1.011, 0.08, 1.011]}
        position-y={-0.459}
        radius={0.032}
      >
        <meshStandardMaterial
          color="#353341"
          roughness={0.62}
          metalness={0.24}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.083, 0.311, 0.041]}
        position={[0.24, 0.027, 0.509]}
        radius={0.017}
      >
        <meshStandardMaterial color="#3c3947" roughness={0.69} />
      </RoundedBox>
      <RoundedBox
        args={[0.055, 0.033, 0.107]}
        position={[0.24, 0.118, 0.553]}
        radius={0.013}
      >
        <meshStandardMaterial
          color={TOASTER_STEEL}
          roughness={0.38}
          metalness={0.46}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.156, 0.066, 0.072]}
        position={[0.24, 0.118, 0.59]}
        radius={0.025}
      >
        <meshStandardMaterial color="#393444" roughness={0.52} />
      </RoundedBox>
      <group position={[-0.221, -0.2, 0.509]} rotation-x={QUARTER_TURN}>
        <mesh>
          <cylinderGeometry args={[0.115, 0.115, 0.035, 26]} />
          <meshStandardMaterial
            color={TOASTER_STEEL}
            roughness={0.42}
            metalness={0.45}
          />
        </mesh>
        <mesh position-y={0.033}>
          <cylinderGeometry args={[0.087, 0.095, 0.062, 24]} />
          <meshStandardMaterial color="#38343f" roughness={0.53} />
        </mesh>
        <mesh position={[0.034, 0.067, 0.046]} rotation-y={0.59}>
          <boxGeometry args={[0.015, 0.008, 0.045]} />
          <meshStandardMaterial color="#ffd896" roughness={0.61} />
        </mesh>
      </group>
      <Bead
        position={[-0.221, 0.015, 0.507]}
        scale={[0.027, 0.027, 0.017]}
        color="#ffa145"
      />
      {[-0.18, 0, 0.18].map((x) => (
        <RoundedBox
          key={x}
          args={[0.1, 0.023, 0.02]}
          position={[x, -0.355, -0.504]}
          radius={0.008}
        >
          <meshStandardMaterial color="#423c49" roughness={0.68} />
        </RoundedBox>
      ))}
      <group ref={bread} position-y={TOASTER_BREAD_REST}>
        {TOASTER_SLOT_Z.map((z) => (
          <group key={z} position={[0, z < 0 ? 0.034 : 0, z]}>
            <mesh position-z={-0.024}>
              <extrudeGeometry args={[TOAST_SLICE, TOAST_CRUST]} />
              <meshStandardMaterial color="#ae6335" roughness={0.85} />
            </mesh>
            {SIDES.map((side) => (
              <mesh
                key={side}
                scale={[0.91, 0.88, 1]}
                position-z={side * 0.031}
                rotation-y={side > 0 ? 0 : Math.PI}
              >
                <extrudeGeometry args={[TOAST_SLICE, TOAST_INSIDE]} />
                <meshStandardMaterial color="#f3cf84" roughness={0.91} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </>
  );
}

function Randoseru() {
  return (
    <group position={[0, -0.012, -0.626]}>
      <RoundedBox args={[0.631, 0.724, 0.323]} radius={0.064}>
        <meshStandardMaterial color="#7e203d" roughness={0.46} />
      </RoundedBox>
      <RoundedBox
        args={[0.654, 0.594, 0.145]}
        position={[0, 0.072, -0.169]}
        radius={0.064}
      >
        <meshStandardMaterial color="#ac3956" roughness={0.44} />
      </RoundedBox>
      <RoundedBox
        args={[0.599, 0.515, 0.044]}
        position={[0, 0.075, -0.234]}
        radius={0.02}
      >
        <meshStandardMaterial color="#b84961" roughness={0.49} />
      </RoundedBox>
      <mesh position={[0, 0.362, 0.028]} scale={[1, 0.81, 1]}>
        <torusGeometry args={[0.116, 0.032, 10, 24, Math.PI]} />
        <meshStandardMaterial color="#67203a" roughness={0.52} />
      </mesh>
      <RoundedBox
        args={[0.084, 0.104, 0.059]}
        position={[0, -0.239, -0.245]}
        radius={0.019}
      >
        <meshStandardMaterial
          color="#d5b0a2"
          metalness={0.55}
          roughness={0.44}
        />
      </RoundedBox>
      {SIDES.map((side) => (
        <group key={side}>
          <RoundedBox
            args={[0.071, 0.588, 0.108]}
            position={[side * 0.213, -0.007, 0.13]}
            radius={0.03}
          >
            <meshStandardMaterial color="#69263e" roughness={0.72} />
          </RoundedBox>
          <Bead
            position={[side * 0.263, -0.143, -0.261]}
            scale={[0.024, 0.024, 0.014]}
            color="#e2b7a7"
          />
        </group>
      ))}
      <mesh position={[0.321, 0.008, -0.112]} rotation-y={QUARTER_TURN}>
        <torusGeometry args={[0.044, 0.009, 8, 20]} />
        <meshStandardMaterial
          color="#d5b0a2"
          metalness={0.49}
          roughness={0.42}
        />
      </mesh>
      <RoundedBox
        args={[0.099, 0.094, 0.084]}
        position={[0.342, -0.064, -0.113]}
        rotation-z={0.22}
        radius={0.03}
      >
        <meshStandardMaterial color="#f7d062" roughness={0.92} />
      </RoundedBox>
    </group>
  );
}

const BAMBOO_BLADE = new Shape();
BAMBOO_BLADE.moveTo(0.04, -0.027);
BAMBOO_BLADE.quadraticCurveTo(0.27, -0.061, 0.45, -0.062);
BAMBOO_BLADE.quadraticCurveTo(0.532, -0.06, 0.538, -0.011);
BAMBOO_BLADE.quadraticCurveTo(0.54, 0.042, 0.479, 0.057);
BAMBOO_BLADE.quadraticCurveTo(0.29, 0.068, 0.04, 0.029);
BAMBOO_BLADE.closePath();
const BAMBOO_BLADE_EXTRUSION = {
  depth: 0.023,
  bevelSize: 0.01,
  bevelThickness: 0.008,
  bevelSegments: 3,
  curveSegments: 12,
};

function BambooCopter() {
  const rotor = useRef<Group>(null);
  const motion = useMotionPreference();
  useFrame((_, delta) => {
    if (rotor.current && !motion.matches)
      rotor.current.rotation.y += delta * 10;
  });

  return (
    <group position-y={0.5}>
      <mesh position-y={0.033}>
        <cylinderGeometry args={[0.138, 0.196, 0.066, 32]} />
        <meshStandardMaterial color="#ac7a2d" roughness={0.66} />
      </mesh>
      <Bead
        position={[0, 0.066, 0]}
        scale={[0.145, 0.065, 0.145]}
        color="#f5b940"
      />
      <mesh position-y={0.245}>
        <cylinderGeometry args={[0.026, 0.039, 0.343, 20]} />
        <meshStandardMaterial
          color="#df9b38"
          roughness={0.42}
          metalness={0.18}
        />
      </mesh>
      <mesh position-y={0.153}>
        <cylinderGeometry args={[0.043, 0.043, 0.047, 20]} />
        <meshStandardMaterial color="#517b60" roughness={0.63} />
      </mesh>
      <group ref={rotor} position-y={0.427} rotation-y={0.18}>
        <Bead
          position={[0, 0.007, 0]}
          scale={[0.099, 0.056, 0.099]}
          color="#e9a430"
        />
        {SIDES.map((side) => (
          <group key={side} rotation-y={side < 0 ? Math.PI : 0}>
            <mesh position-y={-0.009} rotation-x={-QUARTER_TURN}>
              <extrudeGeometry args={[BAMBOO_BLADE, BAMBOO_BLADE_EXTRUSION]} />
              <meshStandardMaterial color="#f4c665" roughness={0.59} />
            </mesh>
            <Bead
              position={[0.365, 0.021, 0]}
              scale={[0.118, 0.004, 0.013]}
              color="#d5983a"
            />
          </group>
        ))}
      </group>
    </group>
  );
}

const HEADBAND_TAIL = new Shape();
HEADBAND_TAIL.moveTo(0, 0.036);
HEADBAND_TAIL.quadraticCurveTo(0.17, 0.029, 0.29, -0.076);
HEADBAND_TAIL.quadraticCurveTo(0.35, -0.129, 0.397, -0.19);
HEADBAND_TAIL.lineTo(0.331, -0.191);
HEADBAND_TAIL.lineTo(0.341, -0.24);
HEADBAND_TAIL.quadraticCurveTo(0.273, -0.204, 0.218, -0.142);
HEADBAND_TAIL.quadraticCurveTo(0.151, -0.086, 0, -0.038);
HEADBAND_TAIL.closePath();
const HEADBAND_TAIL_EXTRUSION = {
  depth: 0.017,
  bevelSize: 0.01,
  bevelThickness: 0.007,
  bevelSegments: 2,
  curveSegments: 12,
};

function Hachimaki() {
  const cotton = "#f5efdf";
  return (
    <group position-y={0.362}>
      <RoundedBox args={[1.047, 0.15, 1.047]} radius={0.036}>
        <meshStandardMaterial color={cotton} roughness={0.96} />
      </RoundedBox>
      {SIDES.map((side) => (
        <RoundedBox
          key={side}
          args={[0.952, 0.019, 0.012]}
          position={[0, side * 0.052, 0.522]}
          radius={0.005}
        >
          <meshStandardMaterial color="#dbcdbe" roughness={0.95} />
        </RoundedBox>
      ))}
      <mesh position-z={0.525} rotation-x={QUARTER_TURN}>
        <cylinderGeometry args={[0.048, 0.048, 0.007, 28]} />
        <meshStandardMaterial color="#c83148" roughness={0.94} />
      </mesh>
      <group position={[0.08, 0, -0.526]} rotation-y={Math.PI}>
        <mesh
          position={[0.055, -0.018, 0.037]}
          rotation-y={-0.22}
          rotation-z={0.23}
        >
          <extrudeGeometry args={[HEADBAND_TAIL, HEADBAND_TAIL_EXTRUSION]} />
          <meshStandardMaterial color={cotton} roughness={0.97} />
        </mesh>
        <mesh
          position={[-0.055, -0.025, 0.047]}
          scale={[-0.86, 1, 1]}
          rotation-y={0.2}
          rotation-z={0.21}
        >
          <extrudeGeometry args={[HEADBAND_TAIL, HEADBAND_TAIL_EXTRUSION]} />
          <meshStandardMaterial color="#e9dfd0" roughness={0.97} />
        </mesh>
        <Bead
          position={[-0.055, 0, 0.042]}
          scale={[0.091, 0.049, 0.041]}
          color="#e5d6c7"
          tilt={0.41}
        />
        <Bead
          position={[0.059, 0.005, 0.035]}
          scale={[0.091, 0.049, 0.042]}
          color={cotton}
          tilt={-0.27}
        />
        <Bead
          position={[0, 0.003, 0.055]}
          scale={[0.058, 0.059, 0.042]}
          color={cotton}
          tilt={0.37}
        />
      </group>
    </group>
  );
}
