export interface ReactionInkDrop {
  delay: number;
  angle: number;
  reach: number;
  radius: number;
  duration: number;
  spreadRadius: number;
}
export function reactionInkPattern(
  kind: "reaction-fan" | "reaction-pair",
): ReactionInkDrop[] {
  return kind === "reaction-fan"
    ? [-2, -1, 0, 1, 2].map((i) => ({
        delay: Math.abs(i) * 0.025,
        angle: i * 0.27,
        reach: (3.8 - Math.abs(i) * 0.25) * 1.5,
        radius: 0.2,
        duration: 0.32,
        spreadRadius: 0.65 * 1.5,
      }))
    : [0].map((i) => ({
        delay: i * 0.19,
        angle: i * 0.07 - 0.035,
        reach: 2.7 + i * 0.25,
        radius: 0.16,
        duration: 0.24,
        spreadRadius: 0.5,
      }));
}
