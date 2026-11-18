import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Shared wet-ink surface. A rough-ish pigment base keeps the team color saturated,
 * while a smooth clearcoat layer carries the glossy highlight and reflections.
 */
export const INK_GLOSS = {
  roughness: 0.35,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  envMapIntensity: 0.1,
} as const;

/**
 * Cosmetic bulge along painted edges. Height is the paint alpha blurred by a mip level,
 * so the rim slopes over roughly 2^blurLevel texels. It never affects ownership.
 */
export const INK_RELIEF = {
  blurLevel: 4,
  strength: 2,
  /** Wet-surface ripples inside the ink, in cycles per paint texture side / 32 texels. */
  rippleStrength: 0.55,
  rippleTexels: 32,
} as const;

const environments = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/**
 * A procedural room reflection, generated once per renderer without any external file.
 * It is applied only to ink materials, never to `scene.environment`.
 */
export function getInkEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  let texture = environments.get(renderer);
  if (!texture) {
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    texture = generator.fromScene(room, 0.04).texture;
    room.dispose();
    generator.dispose();
    environments.set(renderer, texture);
  }
  return texture;
}

export function useInkEnvironment(): THREE.Texture {
  const gl = useThree((state) => state.gl);
  return useMemo(() => getInkEnvironment(gl), [gl]);
}

const RELIEF_PARS = /* glsl */ `
uniform float inkTexel;
uniform float inkBlurLevel;
uniform float inkReliefStrength;
uniform float inkRippleStrength;
uniform float inkRippleScale;
float inkHeight(vec2 uv) {
  return smoothstep(0.05, 0.95, textureLod(map, uv, inkBlurLevel).a);
}
float inkHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float inkNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(inkHash(i), inkHash(i + vec2(1.0, 0.0)), u.x),
    mix(inkHash(i + vec2(0.0, 1.0)), inkHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float inkRipple(vec2 p) {
  return inkNoise(p) * 0.65 + inkNoise(p * 2.7 + 13.1) * 0.35;
}
`;

// Perturbs the shading normal from the blurred paint alpha, using a screen-derivative
// tangent frame (the same construction as three.js getTangentFrame).
const RELIEF_NORMAL = /* glsl */ `
#ifdef USE_MAP
{
  float inkStep = inkTexel * exp2(inkBlurLevel);
  float hL = inkHeight(vMapUv - vec2(inkStep, 0.0));
  float hR = inkHeight(vMapUv + vec2(inkStep, 0.0));
  float hD = inkHeight(vMapUv - vec2(0.0, inkStep));
  float hU = inkHeight(vMapUv + vec2(0.0, inkStep));
  vec3 inkQ0 = dFdx(-vViewPosition);
  vec3 inkQ1 = dFdy(-vViewPosition);
  vec2 inkSt0 = dFdx(vMapUv);
  vec2 inkSt1 = dFdy(vMapUv);
  vec3 inkQ1Perp = cross(inkQ1, normal);
  vec3 inkQ0Perp = cross(normal, inkQ0);
  vec3 inkT = inkQ1Perp * inkSt0.x + inkQ0Perp * inkSt1.x;
  vec3 inkB = inkQ1Perp * inkSt0.y + inkQ0Perp * inkSt1.y;
  float inkDet = max(dot(inkT, inkT), dot(inkB, inkB));
  float inkScale = inkDet == 0.0 ? 0.0 : inversesqrt(inkDet);
  vec3 inkSlope = vec3(hL - hR, hD - hU, 2.0 / max(inkReliefStrength, 0.001));
  // Gentle static ripples on the painted interior, so highlights break up like wet ink.
  vec2 inkP = vMapUv * inkRippleScale;
  float r0 = inkRipple(inkP);
  vec2 rD = vec2(inkRipple(inkP + vec2(0.15, 0.0)), inkRipple(inkP + vec2(0.0, 0.15)));
  float inkInside = 0.25 * (hL + hR + hD + hU);
  inkSlope.xy += (r0 - rD) * inkRippleStrength * inkInside;
  normal = normalize(mat3(inkT * inkScale, inkB * inkScale, normal) * inkSlope);
  // At grazing angles a tilted normal can face away from the camera and render black;
  // keep it facing the viewer slightly so far rims fade to a soft grey instead.
  vec3 inkView = normalize(vViewPosition);
  float inkFacing = dot(normal, inkView);
  normal = normalize(normal + inkView * max(0.0, 0.5 - inkFacing));
}
#endif
`;

/** `onBeforeCompile` for a painted-surface material whose `map` is a square paint canvas. */
export function makeInkRelief(
  textureSize: number,
): (shader: THREE.WebGLProgramParametersWithUniforms) => void {
  return (shader) => {
    shader.uniforms.inkTexel = { value: 1 / textureSize };
    shader.uniforms.inkBlurLevel = { value: INK_RELIEF.blurLevel };
    shader.uniforms.inkReliefStrength = { value: INK_RELIEF.strength };
    shader.uniforms.inkRippleStrength = { value: INK_RELIEF.rippleStrength };
    shader.uniforms.inkRippleScale = {
      value: textureSize / INK_RELIEF.rippleTexels,
    };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_pars_fragment>",
        `#include <map_pars_fragment>\n${RELIEF_PARS}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>\n${RELIEF_NORMAL}`,
      )
      .replace(
        "#include <clearcoat_normal_fragment_maps>",
        "#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal = normal;\n#endif",
      );
  };
}
