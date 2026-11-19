import {
  IMMEDIATE_AIZUCHI,
  type ReactionDecision,
  type ReactionSegment,
} from "@gaya/shared";
interface State {
  revision: number;
  sealed: boolean;
  parts: ReactionSegment[];
}
function canonical(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s、。,.!?…・w笑]/gu, "")
    .replace(/何々|何何/gu, "なになに")
    .replace(/確かに/gu, "たしかに")
    .replace(/流石/gu, "さすが")
    .replace(/知らなかった/gu, "しらなかった")
    .replace(/凄い/gu, "すごい");
}
const immediatePattern = new RegExp(
  `^(?:(?:${IMMEDIATE_AIZUCHI.map(canonical).join("|")})[ー~〜]*)+$`,
  "u",
);
export function immediateAizuchiText(text: string) {
  return immediatePattern.test(canonical(text));
}
export class AizuchiStream {
  private states = new Map<string, State>();
  private get(id: string) {
    let state = this.states.get(id);
    if (!state) {
      state = { revision: 0, sealed: false, parts: [] };
      this.states.set(id, state);
    }
    while (this.states.size > 100)
      this.states.delete(this.states.keys().next().value!);
    return state;
  }
  preview(id: string): number | null {
    const state = this.get(id);
    return state.sealed ? null : ++state.revision;
  }
  commit(
    id: string,
    revision: number,
    text: string,
    decision: ReactionDecision,
  ): ReactionSegment[] {
    const state = this.get(id);
    if (state.sealed || revision !== state.revision || !decision.streamable)
      return [];
    const parts = decision.segments ?? [{ text, level: decision.level }];
    if (
      !parts.every((part) => part.level === "短い相槌") ||
      !state.parts.every(
        (part, index) =>
          parts[index] &&
          canonical(parts[index]!.text) === canonical(part.text),
      )
    )
      return [];
    const fresh = parts.slice(state.parts.length);
    state.parts = parts.map((part) => ({ ...part }));
    return fresh;
  }
  emitted(id: string) {
    return this.get(id).parts.map((part) => ({ ...part }));
  }
  seal(id: string, text: string) {
    const state = this.get(id);
    state.sealed = true;
    const parts = this.emitted(id);
    if (!parts.length) return { parts, remaining: text };
    const prefix = parts.map((part) => canonical(part.text)).join("");
    for (let end = 1; end <= text.length; end++)
      if (canonical(text.slice(0, end)) === prefix)
        return {
          parts,
          remaining: text
            .slice(end)
            .replace(/^[\s、。,.!?，．！？…・wWｗＷ笑ー~〜～]+/u, "")
            .trim(),
        };
    return { parts, remaining: text };
  }
  clear() {
    this.states.clear();
  }
}
