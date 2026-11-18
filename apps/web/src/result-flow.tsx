import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import type { GameState } from "./game-types";
import { PaintOverview } from "./paint-overview";

interface ResultFlowProps {
  scoreA: number;
  scoreB: number;
  colorA?: string;
  colorB?: string;
  preview?: boolean;
  cells?: Uint8Array;
  room?: Room<GameState>;
  onClose?: () => void;
}

export function ResultFlow({
  scoreA,
  scoreB,
  colorA = "#ff4f8b",
  colorB = "#37d9ff",
  preview = false,
  cells,
  room,
  onClose,
}: ResultFlowProps) {
  const [stage, setStage] = useState<
    "finish" | "curtain" | "suspense" | "revealed"
  >("finish");
  const [run, setRun] = useState(0);
  useEffect(() => {
    setStage("finish");
    const dropCurtain = window.setTimeout(() => setStage("curtain"), 1400);
    const showResult = window.setTimeout(() => setStage("suspense"), 2150);
    const reveal = window.setTimeout(() => setStage("revealed"), 4550);
    return () => {
      window.clearTimeout(dropCurtain);
      window.clearTimeout(showResult);
      window.clearTimeout(reveal);
    };
  }, [run]);

  const painted = scoreA + scoreB;
  const percentA = painted ? Math.round((scoreA / painted) * 100) : 0;
  const percentB = painted ? 100 - percentA : 0;
  const revealed = stage === "revealed";

  return (
    <div className="result-screen">
      {stage === "finish" || stage === "curtain" ? (
        <>
          <div className="result-finish-backdrop">
            <div className="result-finish" role="status">
              Finish!
            </div>
          </div>
          {stage === "curtain" && (
            <div className="result-curtain" aria-hidden="true" />
          )}
        </>
      ) : (
        <main className="result-screen-content">
          <p className="result-screen-kicker">MATCH RESULT</p>
          <h1 key={stage} aria-live="polite">
            {revealed
              ? scoreA === scoreB
                ? "引き分け！"
                : `${scoreA > scoreB ? "A" : "B"}チームの勝ち！`
              : "結果発表"}
          </h1>
          <div
            className={`progression-result-meter${revealed ? " progression-result-meter--revealed" : ""}`}
            style={{ backgroundColor: colorB }}
            aria-hidden="true"
          >
            <div
              key={run}
              className="progression-result-meter-fill"
              style={{
                backgroundColor: colorA,
                ...(revealed ? { width: `${painted ? percentA : 50}%` } : {}),
              }}
            />
          </div>
          <div className="progression-result-labels">
            <span>A チーム</span>
            <span>B チーム</span>
          </div>
          <div className="result-screen-scores" aria-hidden={!revealed}>
            {revealed && (
              <>
                <strong style={{ color: colorA }}>{percentA}%</strong>
                <strong style={{ color: colorB }}>{percentB}%</strong>
              </>
            )}
          </div>
          <PaintOverview
            room={room}
            {...(cells ? { cells } : {})}
            revealed={revealed}
            colorA={colorA}
            colorB={colorB}
          />
          {preview ? (
            <div className="result-screen-actions">
              <button onClick={() => setRun((value) => value + 1)}>
                もう一度見る
              </button>
              <button onClick={onClose}>閉じる</button>
            </div>
          ) : (
            onClose && (
              <button className="result-leave" onClick={onClose}>
                ルームを退出
              </button>
            )
          )}
        </main>
      )}
      {preview && (stage === "finish" || stage === "curtain") && (
        <button
          className="result-preview-close"
          onClick={onClose}
          aria-label="プレビューを閉じる"
        >
          ×
        </button>
      )}
    </div>
  );
}
