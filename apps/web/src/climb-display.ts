import { Vector3 } from "three";

// Blend the ledge step while allowing subsequent movement to respond immediately.
const MANTLE_SECONDS = 0.16;

export class MantleBlend {
  private readonly offset = new Vector3();
  private remaining = 0;

  start(display: Vector3, target: Vector3) {
    this.offset.subVectors(display, target);
    this.remaining = MANTLE_SECONDS;
  }

  reset() {
    this.remaining = 0;
  }

  apply(display: Vector3, target: Vector3, delta: number) {
    display.copy(target);
    this.remaining = Math.max(0, this.remaining - delta);
    if (this.remaining > 0) {
      display.addScaledVector(this.offset, this.remaining / MANTLE_SECONDS);
    }
  }
}

// Follow the 30 Hz ground height between packets. Jump animation is added separately.
export function followSurfaceHeight(
  current: number,
  target: number,
  delta: number,
) {
  if (Math.abs(target - current) < 0.001) return target;
  return target + (current - target) * Math.exp(-delta / 0.055);
}
