import {
  FIELD_HALF_SIZE,
  PAINT_GRID_SIZE,
  paintDisks,
  specialOutline,
  type PaintStroke,
} from "@gaya/shared";

/** Translucent pigment outside the owned shape is cosmetic, never additional territory. */
export function bleedSpecialPaint(
  stroke: PaintStroke,
  image: ImageData,
  colorA = "#ff4f8b",
  colorB = "#37d9ff",
): { left: number; top: number; right: number; bottom: number } | undefined {
  const disk = paintDisks(stroke)[0];
  if (!disk?.outlineShape) return;
  const scale = PAINT_GRID_SIZE / (FIELD_HALF_SIZE * 2),
    rotation = disk.rotation ?? 0,
    c = Math.cos(rotation),
    s = Math.sin(rotation);
  const points = specialOutline(disk.outlineShape).map((p) => ({
    x: (disk.x + FIELD_HALF_SIZE + (p.x * c - p.z * s) * disk.radius) * scale,
    y: (disk.z + FIELD_HALF_SIZE + (p.x * s + p.z * c) * disk.radius) * scale,
  }));
  const margin = 32,
    n = PAINT_GRID_SIZE;
  const left = Math.max(
      0,
      Math.floor(Math.min(...points.map((p) => p.x))) - margin,
    ),
    right = Math.min(
      n - 1,
      Math.ceil(Math.max(...points.map((p) => p.x))) + margin,
    );
  const top = Math.max(
      0,
      Math.floor(Math.min(...points.map((p) => p.y))) - margin,
    ),
    bottom = Math.min(
      n - 1,
      Math.ceil(Math.max(...points.map((p) => p.y))) + margin,
    );
  if (right < left || bottom < top) return;
  const canvas = document.createElement("canvas");
  canvas.width = right - left + 1;
  canvas.height = bottom - top + 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.fillStyle = ctx.strokeStyle =
    stroke.practiceColor ?? (stroke.team === "A" ? colorA : colorB);
  ctx.beginPath();
  points.forEach((p, i) =>
    i ? ctx.lineTo(p.x - left, p.y - top) : ctx.moveTo(p.x - left, p.y - top),
  );
  ctx.closePath();
  ctx.filter = "blur(9px)";
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.fill();
  ctx.stroke();
  ctx.filter = "blur(3px)";
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = 3;
  ctx.stroke();
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const source = (y * canvas.width + x) * 4,
        alpha = pixels[source + 3]! / 255;
      if (alpha === 0) continue;
      const target = ((top + y) * n + left + x) * 4,
        oldAlpha = image.data[target + 3]! / 255;
      const outAlpha = alpha + oldAlpha * (1 - alpha);
      for (let channel = 0; channel < 3; channel++)
        image.data[target + channel] =
          (pixels[source + channel]! * alpha +
            image.data[target + channel]! * oldAlpha * (1 - alpha)) /
          outAlpha;
      image.data[target + 3] = outAlpha * 255;
    }
  canvas.width = canvas.height = 0;
  return { left, top, right, bottom };
}
