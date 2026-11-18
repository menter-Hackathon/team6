import { Router, json } from "express";
import { reactionRequestSchema } from "@gaya/shared";
import { EvaluatorBusyError, ReactionEvaluator } from "./reaction-evaluator.js";
import { currentEpisode } from "./episode-sources.js";

export function createReactionRouter(evaluator = new ReactionEvaluator()) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(json({ limit: "16kb" }));
  router.get("/status", (_request, response) =>
    response.json({ state: evaluator.state }),
  );
  router.post("/prepare", (_request, response) => {
    void evaluator.prepare().catch(() => {
      /* Only report the generic state; never log text. */
    });
    response.status(202).json({ state: evaluator.state });
  });
  router.post("/evaluate", async (request, response) => {
    const pair = reactionRequestSchema.safeParse(request.body);
    if (!pair.success) {
      response.status(400).json({ code: "INVALID_REACTION" });
      return;
    }
    const controller = new AbortController();
    const closed = () => controller.abort();
    response.on("close", closed);
    // During a turn, the speaker's entered story is the source (D-090).
    const { roomId, ...reactionPair } = pair.data;
    const source = currentEpisode(roomId) || reactionPair.source;
    try {
      const decision = await evaluator.classify(
        { ...reactionPair, source },
        controller.signal,
      );
      if (!controller.signal.aborted) response.json(decision);
    } catch (error) {
      if (!controller.signal.aborted)
        response.status(error instanceof EvaluatorBusyError ? 429 : 503).json({
          code:
            error instanceof EvaluatorBusyError
              ? "REACTION_BUSY"
              : "REACTION_UNAVAILABLE",
        });
    } finally {
      response.off("close", closed);
    }
  });
  return router;
}
