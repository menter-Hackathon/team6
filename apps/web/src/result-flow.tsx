import { useEffect, useState, type CSSProperties } from "react";
import type { Room } from "@colyseus/sdk";
import type { GameState } from "./game-types";
import { InkSplats, LOGO_SRC } from "./ink-screen";
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
  onReplay?: () => void;
  onDissolve?: () => void;
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
  onReplay,
  onDissolve,
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

  const winner = scoreA === scoreB ? null : scoreA > scoreB ? "A" : "B";
  const burstColors =
    winner === null
      ? [colorA, colorB]
      : winner === "A"
        ? [colorA, colorA, colorB]
        : [colorB, colorB, colorA];

  return (
    <div className="result-screen ink-result">
      <InkSplats />
      <img className="ink-corner-logo" src={LOGO_SRC} alt="ガヤペ！" />
      {stage === "finish" || stage === "curtain" ? (
        <>
          <div className="ink-result-finish" role="status">
            Finish!
          </div>
          {stage === "curtain" && (
            <div className="ink-result-curtain" aria-hidden="true" />
          )}
        </>
      ) : (
        <main className="ink-result-content">
          {revealed && <InkBurst key={`back-${run}`} layer="back" colors={burstColors} />}
          <div className="ink-result-bar">
            <h1 key={stage} aria-live="polite">
              {revealed
                ? winner === null
                  ? "引き分け！"
                  : `${winner}チームの勝ち！`
                : "結果発表…"}
            </h1>
          </div>
          <div className="ink-result-card">
            <div className="ink-result-scoreboard">
              <div
                className={`ink-result-team${winner === "A" ? " is-winner" : ""}`}
                style={{ "--team-ink": colorA } as CSSProperties}
              >
                <span>チーム A</span>
                <strong>{revealed ? `${percentA}%` : "??"}</strong>
              </div>
              <div
                className={`ink-result-meter${revealed ? " progression-result-meter--revealed" : ""}`}
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
              <div
                className={`ink-result-team${winner === "B" ? " is-winner" : ""}`}
                style={{ "--team-ink": colorB } as CSSProperties}
              >
                <span>チーム B</span>
                <strong>{revealed ? `${percentB}%` : "??"}</strong>
              </div>
            </div>
            <PaintOverview
              room={room}
              {...(cells ? { cells } : {})}
              revealed={revealed}
              colorA={colorA}
              colorB={colorB}
            />
            {onReplay || onDissolve ? (
              <div className="ink-result-actions">
                {onReplay && (
                  <button type="button" className="is-primary" onClick={onReplay}>
                    もう一度遊ぶ
                  </button>
                )}
                {onClose && (
                  <button type="button" onClick={onClose}>
                    {room ? "ルームを退出" : "検証を終了"}
                  </button>
                )}
                {onDissolve && (
                  <button type="button" onClick={onDissolve}>
                    ルームを解散
                  </button>
                )}
              </div>
            ) : preview ? (
              <div className="ink-result-actions">
                <button type="button" className="is-primary" onClick={() => setRun((value) => value + 1)}>
                  もう一度見る
                </button>
                <button type="button" onClick={onClose}>
                  閉じる
                </button>
              </div>
            ) : (
              onClose && (
                <div className="ink-result-actions">
                  <button type="button" onClick={onClose}>
                    ルームを退出
                  </button>
                </div>
              )
            )}
          </div>
          {revealed && <InkBurst key={`front-${run}`} layer="front" colors={burstColors} />}
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

/** Repeatable pseudo-random number in [0, 1) so the burst layout stays pure. */
function noise(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const DROP_COUNT = 36;
const SPLATS = [
  { left: 8, top: 30, size: 150 },
  { left: 90, top: 22, size: 120 },
  { left: 14, top: 82, size: 130 },
  { left: 86, top: 78, size: 170 },
  { left: 50, top: 6, size: 90 },
  { left: 30, top: 94, size: 100 },
  { left: 70, top: 96, size: 110 },
] as const;

/**
 * Ink thrown out when the winner is revealed: drops fly from the title
 * (front layer) and big splats stamp onto the background (back layer).
 */
function InkBurst({ layer, colors }: { layer: "back" | "front"; colors: string[] }) {
  const pick = (index: number) => colors[index % colors.length] ?? "#d0197a";
  if (layer === "back") {
    return (
      <div className="ink-burst ink-burst--back" aria-hidden="true">
        {SPLATS.map((splat, index) => (
          <span
            key={index}
            className="ink-burst-splat"
            style={
              {
                left: `${splat.left}%`,
                top: `${splat.top}%`,
                width: `clamp(60px, ${splat.size / 10}vw, ${splat.size}px)`,
                background: pick(index),
                animationDelay: `${0.18 + index * 0.07}s`,
                "--rot": `${Math.round(noise(index, 3) * 360)}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }
  return (
    <div className="ink-burst ink-burst--front" aria-hidden="true">
      {Array.from({ length: DROP_COUNT }, (_, index) => {
        const angle = (index / DROP_COUNT) * Math.PI * 2 + (noise(index, 1) - 0.5) * 0.6;
        const distance = 22 + noise(index, 2) * 38;
        const size = 14 + noise(index, 4) * 34;
        return (
          <span
            key={index}
            className="ink-burst-drop"
            style={
              {
                width: `${size}px`,
                height: `${size * 1.3}px`,
                background: pick(index),
                animationDelay: `${noise(index, 5) * 0.18}s`,
                "--dx": `${(Math.cos(angle) * distance).toFixed(1)}vmin`,
                "--dy": `${(Math.sin(angle) * distance).toFixed(1)}vmin`,
                "--rot": `${Math.round((angle * 180) / Math.PI + 90)}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
