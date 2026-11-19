import { FIELD_HALF_WIDTH, FIELD_HALF_DEPTH } from "@gaya/shared";

const HEIGHT = 6.4;
const WIDTH = FIELD_HALF_WIDTH * 2;
const DEPTH = FIELD_HALF_DEPTH * 2;

/** Inward-facing walls leave the room visible when the follow camera is outside it. */
export function Classroom() {
  return (
    <group name="white-classroom">
      {[
        {
          position: [0, HEIGHT / 2, FIELD_HALF_DEPTH],
          rotation: [0, Math.PI, 0],
          width: WIDTH,
        },
        {
          position: [0, HEIGHT / 2, -FIELD_HALF_DEPTH],
          rotation: [0, 0, 0],
          width: WIDTH,
        },
        {
          position: [-FIELD_HALF_WIDTH, HEIGHT / 2, 0],
          rotation: [0, Math.PI / 2, 0],
          width: DEPTH,
        },
        {
          position: [FIELD_HALF_WIDTH, HEIGHT / 2, 0],
          rotation: [0, -Math.PI / 2, 0],
          width: DEPTH,
        },
      ].map((wall, index) => (
        <group
          key={index}
          position={wall.position as [number, number, number]}
          rotation={wall.rotation as [number, number, number]}
        >
          <mesh receiveShadow>
            <planeGeometry args={[wall.width, HEIGHT]} />
            <meshStandardMaterial color="#f5f5f4" roughness={0.9} />
          </mesh>
          {[0.13, HEIGHT - 0.14].map((height) => (
            <mesh key={height} position={[0, height - HEIGHT / 2, 0.035]}>
              <boxGeometry args={[wall.width, 0.16, 0.07]} />
              <meshStandardMaterial color="#e1e3e3" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Whiteboard and rail at the front of the room. */}
      <group
        position={[0, 3.15, FIELD_HALF_DEPTH - 0.07]}
        rotation={[0, Math.PI, 0]}
      >
        <mesh>
          <planeGeometry args={[15.5, 3.15]} />
          <meshStandardMaterial color="#d9dddd" roughness={0.65} />
        </mesh>
        <mesh position-z={0.02}>
          <planeGeometry args={[15.2, 2.85]} />
          <meshStandardMaterial color="#ffffff" roughness={0.24} />
        </mesh>
        <mesh position={[0, -1.6, 0.12]}>
          <boxGeometry args={[15.6, 0.09, 0.3]} />
          <meshStandardMaterial color="#e3e6e6" />
        </mesh>
      </group>
      {/* Repeated window bays give the long side the proportions of a classroom. */}
      {[-30, -20, -10, 0, 10, 20, 30].map((z) => (
        <group
          key={z}
          position={[FIELD_HALF_WIDTH - 0.045, 3.5, z]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <mesh>
            <planeGeometry args={[5.4, 3.6]} />
            <meshStandardMaterial color="#dfe4e5" roughness={0.55} />
          </mesh>
          <mesh position-z={0.015}>
            <planeGeometry args={[5.1, 3.3]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.15}
              roughness={0.3}
            />
          </mesh>
          {[-2.65, 0, 2.65].map((x) => (
            <mesh key={x} position={[x, 0, 0.07]}>
              <boxGeometry args={[0.1, 3.6, 0.12]} />
              <meshStandardMaterial color="#edf0ef" />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.07]}>
            <boxGeometry args={[5.4, 0.09, 0.12]} />
            <meshStandardMaterial color="#edf0ef" />
          </mesh>
          <mesh position={[0, -1.83, 0.12]}>
            <boxGeometry args={[5.6, 0.12, 0.3]} />
            <meshStandardMaterial color="#e6e9e8" />
          </mesh>
        </group>
      ))}
      {/* Wall-panel joints on the opposite side remain subtle and monochrome. */}
      {[-30, -20, -10, 0, 10, 20, 30].map((z) => (
        <mesh
          key={z}
          position={[-FIELD_HALF_WIDTH + 0.015, HEIGHT / 2, z]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[0.025, HEIGHT - 0.4]} />
          <meshStandardMaterial color="#e4e6e5" />
        </mesh>
      ))}
    </group>
  );
}
