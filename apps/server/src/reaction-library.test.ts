import { expect, it } from "vitest";
import {
  evaluate,
  EXCLUSION_FEATURES,
  FEATURES,
  type Models,
} from "reaction-evaluator";
import { ReactionEvaluator } from "./reaction-evaluator.js";
function scores(values: Partial<Record<keyof Models, number>>): Models {
  const models = {} as Models;
  for (const feature of [...EXCLUSION_FEATURES, ...FEATURES])
    models[feature] = async () => values[feature] ?? 0;
  return models;
}
it("keeps the combined-aizuchi rule and leaves the product-word rule off (D-095)", async () => {
  const product = await evaluate(
    { source: "", reaction: "いいアイデア" },
    scores({ isAizuchi: 0.9 }),
  );
  expect(product).toMatchObject({ level: "短い相槌", rule: "短い相槌" });
  const combined = await evaluate(
    { source: "", reaction: "すげえ、マジか天才、なるほど" },
    scores({ isAizuchiSet: 1 }),
  );
  expect(combined).toMatchObject({
    level: "短い相槌",
    rule: "短い相槌:相槌のセット",
  });
  const excluded = await evaluate(
    { source: "", reaction: "アプリ落ちた" },
    scores({ isMeaningless: 0.9, isAizuchi: 0.1 }),
  );
  expect(excluded.level).toBe("除外");
});
it("keeps the username override ahead of the updated product-word rule", async () => {
  const evaluator = new ReactionEvaluator(
    async () => (pair) => evaluate(pair, scores({ isAizuchi: 0.9 })),
  );
  await expect(
    evaluator.evaluate({
      source: "",
      reaction: "太郎さん、デザインいいね",
      userNames: ["太郎"],
    }),
  ).resolves.toBe("短い相槌");
});
