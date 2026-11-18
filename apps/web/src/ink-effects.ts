import * as THREE from "three";
import {
  reactionInkPattern,
  inkOutlineRadius,
  specialOutline,
  type SpecialShape,
  INK_SCALE,
  INK_SPLAT_SCALE,
  NEON_COLORS,
  practiceColorOwner,
  paintDisks,
  inkTravelTime,
  type PaintDisk,
  type PaintStroke,
} from "@gaya/shared";

export const INK_SETTLE_SECONDS = 0.22;

interface Shot {
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  stroke: PaintStroke;
  surfaceHit?: boolean;
  disk?: PaintDisk;
  surfaceHeight?: number;
  shed: number;
  duration: number;
  trail: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
}
interface Drop {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  radius: number;
  age: number;
  team: number;
  shot?: Shot;
}
interface Spread {
  mesh: THREE.Mesh;
  age: number;
  radius: number;
  impact: boolean;
  delay: number;
  energy: number;
}
const AXIS = new THREE.Vector3(0, 1, 0);
const GRAVITY = 16;
const MAX_DROPS = 200;
const MAX_SECONDARY_DROPS = 168;
const TRAIL_RINGS = 8;
const TRAIL_SIDES = 8;

/** Cosmetic only. Permanent paint and dive ownership always come from the shared grid. */
export class InkEffects {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.LatheGeometry;
  private readonly splat = new THREE.ShapeGeometry(
    new THREE.Shape(
      Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2,
          radius = inkOutlineRadius(-a);
        return new THREE.Vector2(Math.cos(a) * radius, Math.sin(a) * radius);
      }),
    ),
  );
  private readonly shapes: Record<
    Exclude<SpecialShape, "ink">,
    THREE.ShapeGeometry
  > = {
    star: this.outlineGeometry("star"),
    heart: this.outlineGeometry("heart"),
  };
  private readonly circle = new THREE.CircleGeometry(1, 40);
  private readonly materials = [
    "#ff4f8b",
    "#37d9ff",
    ...NEON_COLORS.map((entry) => entry.hex),
  ].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.13,
        metalness: 0.04,
      }),
  );
  setColors(colorA: string, colorB: string): void {
    this.materials[0]!.color.set(colorA);
    this.materials[1]!.color.set(colorB);
  }
  private readonly waveGeometry = this.makeWaveGeometry();
  private waves: {
    mesh: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
    age: number;
    radius: number;
  }[] = [];
  private drops: Drop[] = [];
  private spreads: Spread[] = [];
  private readonly direction = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  private makeWaveGeometry(): THREE.ShapeGeometry {
    const outer = Array.from({ length: 97 }, (_, i) => {
      const a = (i / 96) * Math.PI * 2,
        r = inkOutlineRadius(a);
      return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    });
    const shape = new THREE.Shape(outer);
    shape.holes.push(
      new THREE.Path(
        [...outer].reverse().map((p) => p.clone().multiplyScalar(0.84)),
      ),
    );
    return new THREE.ShapeGeometry(shape);
  }
  private wave(
    x: number,
    z: number,
    height: number,
    team: number,
    radius: number,
  ): void {
    if (this.waves.length >= 24) return;
    const material = new THREE.MeshBasicMaterial({
      color: this.materials[team]!.color,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.waveGeometry, material);
    mesh.name = "aizuchi-wave";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, height + 0.045, z);
    mesh.scale.setScalar(0.001);
    this.group.add(mesh);
    this.waves.push({ mesh, age: 0, radius });
  }

  private outlineGeometry(
    shape: Exclude<SpecialShape, "ink">,
  ): THREE.ShapeGeometry {
    return new THREE.ShapeGeometry(
      new THREE.Shape(
        specialOutline(shape).map((p) => new THREE.Vector2(p.x, -p.z)),
      ),
    );
  }

  constructor() {
    const profile = Array.from({ length: 49 }, (_, i) => {
      const t = i / 48;
      return new THREE.Vector2(
        2.8 * t ** 1.5 * Math.sqrt(1 - t),
        -1.7 + 2.6 * t,
      );
    });
    this.geometry = new THREE.LatheGeometry(profile, 32);
  }

  emit(
    stroke: PaintStroke,
    surface?: THREE.Vector3,
    surfaceHeight = 0,
  ): number {
    const team = stroke.practiceColor
      ? practiceColorOwner(stroke.practiceColor) + 1
      : stroke.team === "A"
        ? 0
        : 1;
    if (stroke.kind === "reaction-fan" || stroke.kind === "reaction-pair") {
      const pattern = reactionInkPattern(stroke.kind),
        disks = paintDisks(stroke);
      if (stroke.kind === "reaction-fan")
        this.wave(stroke.x, stroke.z, surfaceHeight, team, 1.5);
      pattern.forEach((part, index) => {
        if (this.drops.length >= MAX_DROPS) return;
        const disk = disks[index]!;
        const origin = new THREE.Vector3(
          stroke.x - Math.sin(stroke.yaw) * 0.65,
          1.1 + ((stroke as PaintStroke & { height?: number }).height ?? 0),
          stroke.z + Math.cos(stroke.yaw) * 0.65,
        );
        const velocity = new THREE.Vector3(
          disk.x,
          surfaceHeight + 0.035,
          disk.z,
        )
          .sub(origin)
          .divideScalar(part.duration);
        velocity.y += 0.5 * GRAVITY * part.duration;
        const drop = this.addDrop(
          origin,
          velocity,
          part.radius * INK_SCALE,
          team,
        );
        drop.age = -part.delay;
        drop.mesh.visible = part.delay === 0;
        drop.shot = {
          origin,
          velocity: velocity.clone(),
          stroke,
          disk,
          surfaceHeight,
          shed: 0,
          duration: part.duration,
          trail: this.createTrail(team),
        };
      });
      return Math.max(...pattern.map((part) => part.delay + part.duration));
    }
    if (stroke.kind !== "ink") {
      this.spread(stroke, team, surfaceHeight);
      if (stroke.kind === "slam") {
        for (
          let i = 0;
          i < 20 && this.drops.length < MAX_SECONDARY_DROPS;
          i++
        ) {
          const angle = (i / 20) * Math.PI * 2,
            speed = 3.5 + Math.random() * 3;
          const position = new THREE.Vector3(
            stroke.x + Math.cos(angle) * 0.6,
            0.09 + surfaceHeight,
            stroke.z + Math.sin(angle) * 0.6,
          );
          const velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            1.4 + Math.random() * 1.6,
            Math.sin(angle) * speed,
          );
          this.addDrop(
            position,
            velocity,
            (0.055 + Math.random() * 0.055) * INK_SCALE,
            team,
          );
        }
      }
      return 0;
    }
    const impact = paintDisks(stroke)[0]!;
    const origin = new THREE.Vector3(
      stroke.x - Math.sin(stroke.yaw) * (surface ? 0.32 : 0.65),
      1.1 + ((stroke as PaintStroke & { height?: number }).height ?? 0),
      stroke.z + Math.cos(stroke.yaw) * (surface ? 0.32 : 0.65),
    );
    const destination =
      surface?.clone() ?? new THREE.Vector3(impact.x, 0.035, impact.z);
    const duration = inkTravelTime(stroke.pitch ?? 0, Math.hypot(destination.x - origin.x, destination.z - origin.z), destination.y - origin.y);
    if (this.drops.length >= MAX_DROPS) return duration;
    const velocity = destination.sub(origin).divideScalar(duration);
    velocity.y += 0.5 * GRAVITY * duration;
    const radius = 0.22 * INK_SCALE * (stroke.scale ?? 1);
    const drop = this.addDrop(origin, velocity, radius, team);
    drop.mesh.scale.set(radius * 0.8, radius * 1.9, radius * 0.8);
    drop.shot = {
      origin,
      velocity: velocity.clone(),
      stroke,
      surfaceHit: Boolean(surface),
      shed: 0,
      duration,
      trail: this.createTrail(team),
    };
    return duration;
  }

  private createTrail(team: number): Shot["trail"] {
    const geometry = new THREE.BufferGeometry();
    const size = TRAIL_RINGS * (TRAIL_SIDES + 1) * 3;
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(size), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(size), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const indices: number[] = [];
    for (let ring = 0; ring < TRAIL_RINGS - 1; ring++) {
      for (let side = 0; side < TRAIL_SIDES; side++) {
        const a = ring * (TRAIL_SIDES + 1) + side,
          b = a + TRAIL_SIDES + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, this.materials[team]!);
    mesh.visible = false;
    this.group.add(mesh);
    return mesh;
  }

  /** A short, tapering liquid thread joins the drop to its trailing tip. */
  private updateTrail(drop: Drop, shot: Shot): void {
    const positions = shot.trail.geometry.getAttribute("position");
    const normals = shot.trail.geometry.getAttribute("normal");
    shot.trail.visible = drop.age > 0.012;
    this.direction.copy(drop.velocity).normalize();
    this.right.crossVectors(this.direction, AXIS);
    if (this.right.lengthSq() < 0.001) this.right.set(1, 0, 0);
    this.right.normalize();
    this.up.crossVectors(this.right, this.direction).normalize();
    for (let ring = 0; ring < TRAIL_RINGS; ring++) {
      const u = ring / (TRAIL_RINGS - 1);
      const t = Math.max(
        0,
        Math.min(drop.age, shot.duration) - 0.014 - u * 0.035,
      );
      this.center.copy(shot.origin).addScaledVector(shot.velocity, t);
      this.center.y -= 0.5 * GRAVITY * t * t;
      const radius =
        drop.radius *
        (0.005 + 0.37 * (1 - u) ** 0.8) *
        Math.min(1, drop.age / 0.025);
      for (let side = 0; side <= TRAIL_SIDES; side++) {
        const angle = (side / TRAIL_SIDES) * Math.PI * 2,
          index = ring * (TRAIL_SIDES + 1) + side;
        this.normal
          .copy(this.right)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(this.up, Math.sin(angle));
        positions.setXYZ(
          index,
          this.center.x + this.normal.x * radius,
          this.center.y + this.normal.y * radius,
          this.center.z + this.normal.z * radius,
        );
        normals.setXYZ(index, this.normal.x, this.normal.y, this.normal.z);
      }
    }
    positions.needsUpdate = normals.needsUpdate = true;
    shot.trail.geometry.computeBoundingSphere();
  }

  private addDrop(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    team: number,
  ): Drop {
    const mesh = new THREE.Mesh(this.geometry, this.materials[team]!);
    mesh.position.copy(position);
    mesh.scale.set(radius, radius * 1.6, radius);
    mesh.quaternion.setFromUnitVectors(AXIS, velocity.clone().normalize());
    mesh.castShadow = radius > 0.1;
    this.group.add(mesh);
    const drop: Drop = { mesh, velocity, radius, age: 0, team };
    this.drops.push(drop);
    return drop;
  }

  private spread(stroke: PaintStroke, team: number, surfaceHeight = 0): void {
    const disks = paintDisks(stroke);
    const step =
      stroke.kind === "ink" || stroke.kind === "slam"
        ? 1
        : Math.max(1, Math.ceil(disks.length / 16));
    for (let i = 0; i < disks.length; i += step) {
      this.addSpread(
        disks[i]!,
        team,
        stroke.kind === "ink" || stroke.kind === "slam",
        stroke.kind === "ink" || stroke.kind === "slam"
          ? Math.min(i * 0.004, 0.025)
          : 0,
        surfaceHeight,
      );
    }
  }

  private addSpread(
    disk: PaintDisk,
    team: number,
    impact: boolean,
    delay: number,
    surfaceHeight = 0,
    energy = 1,
  ): void {
    if (this.spreads.length >= 120) return;
    const mesh = new THREE.Mesh(
      disk.outlineShape
        ? this.shapes[disk.outlineShape]
        : disk.organic
          ? this.splat
          : this.circle,
      this.materials[team]!,
    );
    mesh.rotation.x = -Math.PI / 2;
    if (disk.outlineShape) mesh.rotation.z = -(disk.rotation ?? 0);
    mesh.position.set(disk.x, surfaceHeight + 0.027, disk.z);
    mesh.scale.setScalar(0.001);
    this.group.add(mesh);
    this.spreads.push({
      mesh,
      age: 0,
      radius: disk.radius,
      impact,
      delay,
      energy,
    });
  }

  private impact(shot: Shot, team: number): void {
    const strong = shot.stroke.kind === "reaction-fan";
    if (shot.disk)
      this.addSpread(
        shot.disk,
        team,
        true,
        0,
        shot.surfaceHeight ?? 0,
        strong ? 1.8 : 1,
      );
    else this.spread(shot.stroke, team);
    const center = shot.disk ?? paintDisks(shot.stroke)[0]!;
    if (strong)
      this.wave(
        center.x,
        center.z,
        shot.surfaceHeight ?? 0,
        team,
        center.radius * 1.2,
      );
    const forward = new THREE.Vector3(
      -Math.sin(shot.stroke.yaw),
      0,
      Math.cos(shot.stroke.yaw),
    );
    // A low fan of liquid flicks follows the incoming momentum, rather than a fountain.
    const count = strong ? 10 : 6;
    for (let i = 0; i < count && this.drops.length < MAX_SECONDARY_DROPS; i++) {
      const a = (i / (count - 1) - 0.5) * 2.8 + (Math.random() - 0.5) * 0.2;
      const direction = forward.clone().applyAxisAngle(AXIS, a);
      const position = new THREE.Vector3(
        center.x,
        0.06 + (shot.surfaceHeight ?? 0),
        center.z,
      ).addScaledVector(direction, 0.18);
      const velocity = direction.multiplyScalar(
        (1.8 + Math.random() * 1.5) * INK_SPLAT_SCALE * (strong ? 1.3 : 1),
      );
      velocity.y = (0.75 + Math.random() * 0.9) * (strong ? 1.25 : 1);
      this.addDrop(
        position,
        velocity,
        (0.035 + Math.random() * 0.04) * INK_SCALE * (strong ? 1.35 : 1),
        team,
      );
    }
  }

  private removeDrop(drop: Drop, index: number): void {
    this.group.remove(drop.mesh);
    if (drop.shot) {
      this.group.remove(drop.shot.trail);
      drop.shot.trail.geometry.dispose();
    }
    this.drops.splice(index, 1);
  }

  update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const p = this.drops[i]!;
      p.age += dt;
      if (p.age < 0) continue;
      p.mesh.visible = true;
      if (p.shot) {
        const shot = p.shot,
          t = Math.min(p.age, shot.duration);
        p.mesh.position.copy(shot.origin).addScaledVector(shot.velocity, t);
        p.mesh.position.y -= 0.5 * GRAVITY * t * t;
        p.velocity.copy(shot.velocity);
        p.velocity.y -= GRAVITY * t;
        const stretch = 1.65 + Math.min(0.65, p.velocity.length() * 0.019);
        const width = p.radius / Math.sqrt(stretch),
          wobble = Math.sin(p.age * 26) * 0.04;
        p.mesh.scale.lerp(
          this.scale.set(
            width * (1 + wobble),
            p.radius * stretch,
            width / (1 + wobble),
          ),
          1 - Math.exp(-dt * 24),
        );
        this.updateTrail(p, shot);
        const strong = shot.stroke.kind === "reaction-fan";
        if (
          p.age < shot.duration * (strong ? 0.92 : 0.85) &&
          p.age >=
            shot.duration *
              (strong ? 0.12 + shot.shed * 0.12 : 0.2 + shot.shed * 0.17) &&
          shot.shed < (strong ? 6 : 4) &&
          this.drops.length < MAX_SECONDARY_DROPS
        ) {
          const velocity = p.velocity
            .clone()
            .multiplyScalar(0.74 + Math.random() * 0.08);
          velocity.x += (Math.random() - 0.5) * 1.3;
          velocity.y += (Math.random() - 0.5) * 0.8;
          velocity.z += (Math.random() - 0.5) * 1.3;
          const position = p.mesh.position
            .clone()
            .addScaledVector(p.velocity.clone().normalize(), -p.radius * 1.7);
          this.addDrop(
            position,
            velocity,
            p.radius * (0.18 + Math.random() * 0.11),
            p.team,
          );
          shot.shed++;
        }
        if (p.age >= shot.duration) {
          if (!shot.surfaceHit) this.impact(shot, p.team);
          this.removeDrop(p, i);
          continue;
        }
      } else {
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.position.y -= 0.5 * GRAVITY * dt * dt;
        p.velocity.y -= GRAVITY * dt;
        const stretch = 1.3 + Math.min(0.9, p.velocity.length() * 0.16);
        p.mesh.scale.set(
          p.radius / Math.sqrt(stretch),
          p.radius * stretch,
          p.radius / Math.sqrt(stretch),
        );
        if (p.mesh.position.y <= 0.03 || p.age > 0.5) {
          this.removeDrop(p, i);
          continue;
        }
      }
      p.mesh.quaternion.setFromUnitVectors(
        AXIS,
        this.direction.copy(p.velocity).normalize(),
      );
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i]!;
      wave.age += dt;
      const t = Math.min(1, wave.age / 0.28);
      wave.mesh.scale.setScalar(wave.radius * (0.3 + 0.9 * (1 - (1 - t) ** 3)));
      wave.mesh.material.opacity = 0.7 * (1 - t) ** 2;
      if (t >= 1) {
        this.group.remove(wave.mesh);
        wave.mesh.material.dispose();
        this.waves.splice(i, 1);
      }
    }
    for (let i = this.spreads.length - 1; i >= 0; i--) {
      const p = this.spreads[i]!;
      p.age += dt;
      const t = THREE.MathUtils.clamp(
        (p.age - p.delay) / (INK_SETTLE_SECONDS - p.delay),
        0,
        1,
      );
      // A fast impact, a slight overshoot, then a smooth settle into the exact owned shape.
      const expansion = p.impact
        ? 1 - (1 - t) ** 5 + 0.28 * p.energy * Math.sin(Math.PI * t) * (1 - t)
        : 1 - (1 - t) ** 3;
      const pressure = p.impact ? Math.sin(Math.PI * t) * 0.1 * p.energy : 0;
      p.mesh.scale.set(
        p.radius * expansion * (1 + pressure),
        (p.radius * expansion) / (1 + pressure),
        1,
      );
      if (p.age >= INK_SETTLE_SECONDS) {
        this.group.remove(p.mesh);
        this.spreads.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const wave of this.waves) wave.mesh.material.dispose();
    this.waves = [];
    for (const drop of this.drops) drop.shot?.trail.geometry.dispose();
    this.group.clear();
    this.drops = [];
    this.spreads = [];
  }
  dispose(): void {
    this.clear();
    this.geometry.dispose();
    this.waveGeometry.dispose();
    this.circle.dispose();
    this.splat.dispose();
    this.shapes.star.dispose();
    this.shapes.heart.dispose();
    for (const material of this.materials) material.dispose();
  }
}
