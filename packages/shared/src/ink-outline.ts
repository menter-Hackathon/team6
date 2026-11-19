/**
 * Splat outlines shared by server ownership and client rendering.
 *
 * Organic disks scale their radius by an angular outline. Plain ink shots cycle through a
 * fixed library of precomputed variants so successive splats differ, while every variant
 * encloses the same area as the legacy outline: the choice is cosmetic and never changes
 * how much territory a shot claims.
 */

/** Number of precomputed ink splat shapes a client cycles through. */
export const INK_VARIANT_COUNT = 8;

const SAMPLES = 256;
const TAU = Math.PI * 2;

/** The original wobbly outline, still used by organic disks that carry no variant. */
export function inkOutlineRadius(angle: number): number {
  return 0.77 + 0.13 * Math.sin(angle * 7) + 0.1 * Math.cos(angle * 11);
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrappedDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

/** Twice the enclosed area of a radial outline sampled at equal angles. */
function doubledArea(radius: (angle: number) => number): number {
  let sum = 0;
  for (let i = 0; i < SAMPLES; i++) sum += radius((i / SAMPLES) * TAU) ** 2;
  return (sum / SAMPLES) * TAU;
}

const REFERENCE_AREA = doubledArea(inkOutlineRadius);

/**
 * Relative angle 0 points along the shot. Each shape leans forward like an impact, with
 * a few seeded lobes and thin fingers mostly thrown ahead of the landing point.
 */
function buildVariant(variant: number): Float32Array {
  const random = seededRandom(0x1a2b3c + variant * 7919);
  const harmonics = Array.from({ length: 5 }, (_, i) => ({
    k: i + 3,
    amplitude: (0.05 + random() * 0.05) * (3 / (i + 3)),
    phase: random() * TAU,
  }));
  const fingers = Array.from({ length: 2 + Math.floor(random() * 3) }, (_, i) => ({
    // Alternate sides of the shot line; most fingers fly forward, one may trail back.
    angle:
      (i % 2 ? 1 : -1) * (0.25 + random() * 0.95) +
      (random() < 0.2 ? Math.PI : 0),
    amplitude: 0.14 + random() * 0.16,
    width: 0.07 + random() * 0.07,
  }));
  const raw = (angle: number) => {
    let r = 1 + 0.14 * Math.cos(angle);
    for (const h of harmonics) r += h.amplitude * Math.cos(h.k * angle + h.phase);
    for (const f of fingers)
      r += f.amplitude * Math.exp(-((wrappedDistance(angle, f.angle) / f.width) ** 2));
    return r;
  };
  const scale = Math.sqrt(REFERENCE_AREA / doubledArea(raw));
  return Float32Array.from({ length: SAMPLES }, (_, i) => raw((i / SAMPLES) * TAU) * scale);
}

const VARIANTS = Array.from({ length: INK_VARIANT_COUNT }, (_, v) => buildVariant(v));

/** Largest radius multiplier of any variant, for rasterization bounds. */
export const INK_VARIANT_MAX_SCALE = Math.max(
  1,
  ...VARIANTS.map((table) => Math.max(...table)),
);

/** Table lookup with linear interpolation: cheaper than evaluating trig per pixel. */
export function inkVariantRadius(variant: number, relativeAngle: number): number {
  const table = VARIANTS[variant] ?? VARIANTS[0]!;
  const position = ((((relativeAngle / TAU) % 1) + 1) % 1) * SAMPLES;
  const index = Math.floor(position);
  const t = position - index;
  const a = table[index % SAMPLES]!,
    b = table[(index + 1) % SAMPLES]!;
  return a + (b - a) * t;
}

export function isInkVariant(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < INK_VARIANT_COUNT
  );
}

/** Radius multiplier of an organic disk at a world angle `atan2(z, x)`. */
export function organicOutlineScale(
  disk: { variant?: number; rotation?: number },
  angle: number,
): number {
  return disk.variant === undefined
    ? inkOutlineRadius(angle)
    : inkVariantRadius(disk.variant, angle - (disk.rotation ?? 0));
}

/** Upper bound of `organicOutlineScale` for the disk. */
export function organicOutlineMaxScale(disk: { variant?: number }): number {
  return disk.variant === undefined ? 1 : INK_VARIANT_MAX_SCALE;
}
