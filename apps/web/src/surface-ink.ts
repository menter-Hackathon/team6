import { inkOutlineRadius } from "@gaya/shared";

const outlineSamples = Array.from({ length: 97 }, (_, i) => {
  const angle = (i / 96) * Math.PI * 2;
  return {
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    radius: inkOutlineRadius(angle),
  };
});

// Glancing hits can produce a different radius each time. Bound retained paths.
const maxCachedPaths = 64;
const paths = new Map<number, Path2D>();

export function fillSurfaceInk(ctx: CanvasRenderingContext2D, radius: number) {
  let path = paths.get(radius);
  if (!path) {
    path = new Path2D();
    for (const [i, sample] of outlineSamples.entries()) {
      // Scale before projecting, as in the original canvas path, to preserve edge pixels.
      const r = radius * sample.radius;
      const x = sample.cos * r;
      const y = sample.sin * r;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    if (paths.size >= maxCachedPaths) paths.delete(paths.keys().next().value!);
    paths.set(radius, path);
  }
  ctx.fill(path);
}
