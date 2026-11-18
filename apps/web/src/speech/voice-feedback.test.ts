import { describe, it, expect } from "vitest";
import { VoiceInkPulse } from "./voice-feedback";
import { InkEffects } from "../ink-effects";

describe("voice ink feedback", () => {
  it("responds on onset, scales cadence with volume, and stops on silence/stale input", () => {
    const pulse = new VoiceInkPulse();
    expect(pulse.update(0.016, 0.6, false, true)).toBeNull();
    expect(pulse.update(0.016, 0.6, true, true)).toBe(0.6);
    expect(pulse.update(0.016, 0.6, true, true)).toBeNull();
    expect(pulse.update(0.016, 0.6, true, false)).toBeNull();
    expect(pulse.update(0.016, 0.6, true, true)).toBe(0.6);
    expect(pulse.update(0.016, NaN, true, true)).toBeNull();
    const count = (level: number) => {
      const emitter = new VoiceInkPulse();
      let shots = 0;
      for (let i = 0; i < 120; i++)
        if (emitter.update(1 / 60, level, true, true) !== null) shots++;
      return shots;
    };
    expect(count(1)).toBeGreaterThan(count(0.1));
    expect(count(1)).toBeLessThanOrEqual(24);
  });
  it("launches liquid from the current player front and erases every transient mesh", () => {
    const effects = new InkEffects();
    effects.emitVoice(3, -2, Math.PI / 2, 0.8, 1.5);
    const drop = effects.group.children[0]!;
    expect(drop.position.x).toBeLessThan(3);
    expect(drop.position.y).toBeCloseTo(2.35);
    for (let i = 0; i < 8; i++) effects.update(0.05);
    expect(
      effects.group.children.some((mesh) => mesh.position.y === 0.027),
    ).toBe(true);
    for (let i = 0; i < 30; i++) effects.update(0.05);
    expect(effects.group.children).toHaveLength(0);
    effects.dispose();
  });
  it("bounds mesh count during continuous voice and disposes pending splashes on clear", () => {
    const effects = new InkEffects();
    for (let i = 0; i < 500; i++) effects.emitVoice(0, 0, 0, 1);
    expect(effects.group.children.length).toBeLessThanOrEqual(336);
    effects.clear();
    expect(effects.group.children).toHaveLength(0);
    effects.dispose();
  });
});
