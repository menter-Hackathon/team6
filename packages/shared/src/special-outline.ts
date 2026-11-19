import type { SpecialShape } from "./index.js";
export interface OutlinePoint {
  x: number;
  z: number;
}

/** A readable silhouette with small, deterministic wet edges. */
export function specialOutline(
  shape: Exclude<SpecialShape, "ink">,
): OutlinePoint[] {
  const points: OutlinePoint[] = [];
  if (shape === "heart") {
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      points.push({
        x: (16 * Math.sin(a) ** 3) / 18,
        z:
          (13 * Math.cos(a) -
            5 * Math.cos(2 * a) -
            2 * Math.cos(3 * a) -
            Math.cos(4 * a)) /
            18 +
          0.13,
      });
    }
  } else {
    const corners = Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI / 2 + (i * Math.PI) / 5 + 0.018 * Math.sin(i * 2.1),
        r =
          i % 2 === 0
            ? 1 + 0.055 * Math.sin(i * 1.9)
            : 0.53 + 0.025 * Math.cos(i * 1.7);
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    });
    // Closed cubic curves run along every edge, not just around the corners.
    for (let i = 0; i < corners.length; i++) {
      const prev = corners[(i + 9) % 10]!,
        from = corners[i]!,
        to = corners[(i + 1) % 10]!,
        next = corners[(i + 2) % 10]!;
      const c1 = {
        x: from.x + (to.x - prev.x) * 0.28,
        z: from.z + (to.z - prev.z) * 0.28,
      };
      const c2 = {
        x: to.x - (next.x - from.x) * 0.28,
        z: to.z - (next.z - from.z) * 0.28,
      };
      for (let j = 0; j < 12; j++) {
        const t = j / 12,
          v = 1 - t;
        points.push({
          x:
            v * v * v * from.x +
            3 * v * v * t * c1.x +
            3 * v * t * t * c2.x +
            t * t * t * to.x,
          z:
            v * v * v * from.z +
            3 * v * v * t * c1.z +
            3 * v * t * t * c2.z +
            t * t * t * to.z,
        });
      }
    }
  }
  const wetPoints = points.map((p, i) => {
    const phase = (i / points.length) * Math.PI * 2;
    const wet =
      shape === "star"
        ? 1 + 0.018 * Math.sin(phase * 13) + 0.01 * Math.cos(phase * 19)
        : 1 + 0.025 * Math.sin(phase * 7) + 0.012 * Math.cos(phase * 11);
    return { x: p.x * wet, z: p.z * wet };
  });
  const area = wetPoints.reduce((sum, p, i) => {
    const next = wetPoints[(i + 1) % wetPoints.length]!;
    return sum + p.x * next.z - next.x * p.z;
  }, 0);
  const sign = area >= 0 ? 1 : -1;
  const jets =
    shape === "star"
      ? [7, 22, 29, 46, 65, 73, 91, 106]
      : [16, 24, 33, 42, 51, 60, 73, 82, 91, 102, 112];
  return wetPoints.map((p, i) => {
    const before = wetPoints[(i - 1 + wetPoints.length) % wetPoints.length]!,
      after = wetPoints[(i + 1) % wetPoints.length]!;
    const tx = after.x - before.x,
      tz = after.z - before.z,
      length = Math.hypot(tx, tz) || 1;
    let protrusion = 0,
      bend = 0;
    for (let j = 0; j < jets.length; j++) {
      const distance = Math.min(
        Math.abs(i - jets[j]!),
        wetPoints.length - Math.abs(i - jets[j]!),
      );
      const width = (shape === "heart" ? 0.65 : 0.75) + (j % 3) * 0.3;
      const spike = Math.exp((-distance * distance) / (2 * width * width));
      protrusion +=
        ((shape === "heart" ? 0.16 : 0.11) +
          (j % 4) * (shape === "heart" ? 0.045 : 0.035)) *
        spike;
      bend += 0.018 * Math.sin(j * 2.4) * spike;
    }
    return {
      x: p.x + ((sign * tz) / length) * protrusion + (tx / length) * bend,
      z: p.z - ((sign * tx) / length) * protrusion + (tz / length) * bend,
    };
  });
}
