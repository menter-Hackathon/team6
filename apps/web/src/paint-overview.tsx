import { useEffect, useRef } from "react";
import type { Room } from "@colyseus/sdk";
import { PAINT_GRID_SIZE } from "@gaya/shared";
import type { GameState } from "./game-types";

const MAP_SIZE = 512;

interface PaintOverviewProps {
  room?: Room<GameState> | undefined;
  preview?: boolean;
  revealed: boolean;
  colorA: string;
  colorB: string;
}

export function PaintOverview({
  room,
  preview = false,
  revealed,
  colorA,
  colorB,
}: PaintOverviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    let disposed = false;
    const rgbA = [1, 3, 5].map((index) =>
      parseInt(colorA.slice(index, index + 2), 16),
    );
    const rgbB = [1, 3, 5].map((index) =>
      parseInt(colorB.slice(index, index + 2), 16),
    );
    const draw = (cells?: Uint8Array) => {
      if (disposed) return;
      const image = context.createImageData(MAP_SIZE, MAP_SIZE);
      for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
          const owner = cells
            ? cells[
                Math.floor((y * PAINT_GRID_SIZE) / MAP_SIZE) * PAINT_GRID_SIZE +
                  Math.floor((x * PAINT_GRID_SIZE) / MAP_SIZE)
              ]
            : preview
              ? Math.sin(x * 0.07) +
                  Math.cos(y * 0.09) +
                  Math.sin((x + y) * 0.045) >
                0.6
                ? 1
                : Math.sin(x * 0.055 - y * 0.08) > -0.2
                  ? 2
                  : 0
              : 0;
          const offset = (y * MAP_SIZE + x) * 4;
          const rgb = owner === 1 ? rgbA : owner === 2 ? rgbB : [206, 215, 205];
          image.data[offset] = rgb[0]!;
          image.data[offset + 1] = rgb[1]!;
          image.data[offset + 2] = rgb[2]!;
          image.data[offset + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
    };
    draw();
    if (!room)
      return () => {
        disposed = true;
      };
    const remove = room.onMessage(
      "paint-snapshot",
      async (snapshot: { revision: number; data: string }) => {
        try {
          const bytes = Uint8Array.from(atob(snapshot.data), (char) =>
            char.charCodeAt(0),
          );
          const stream = new Blob([bytes])
            .stream()
            .pipeThrough(new DecompressionStream("deflate"));
          const cells = new Uint8Array(
            await new Response(stream).arrayBuffer(),
          );
          if (cells.length === PAINT_GRID_SIZE ** 2) draw(cells);
        } catch (error) {
          console.error("陣地マップを表示できませんでした", error);
        }
      },
    );
    room.send("paint-snapshot");
    return () => {
      disposed = true;
      remove?.();
    };
  }, [room, preview, colorA, colorB]);

  return (
    <div
      className={`paint-overview${revealed ? " paint-overview--revealed" : ""}`}
    >
      <canvas
        ref={canvasRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        role="img"
        aria-label="試合終了時の陣地を上から見た地図"
      />
    </div>
  );
}
