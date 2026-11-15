import { Canvas } from "@react-three/fiber";
import { Client, type Room } from "@colyseus/sdk";
import { Suspense, useEffect, useRef, useState } from "react";
import { GAME_ROOM_NAME } from "@gaya/shared";
import type { GameState } from "./game-types";
import { GameScene } from "./game-scene";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:2567";

export function App() {
  const roomRef = useRef<Room<GameState> | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [playerIds, setPlayerIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let joinedRoom: Room<GameState> | null = null;

    const connect = async () => {
      try {
        const client = new Client(SERVER_URL);
        joinedRoom = await client.joinOrCreate<GameState>(GAME_ROOM_NAME);
        const initialState = await new Promise<GameState>((resolve) => {
          joinedRoom?.onStateChange.once(resolve);
        });
        if (cancelled) {
          await joinedRoom.leave();
          return;
        }

        roomRef.current = joinedRoom;
        setConnectionState("connected");
        const syncPlayerIds = (state: GameState) => {
          setPlayerIds(Array.from(state.players.keys()));
        };
        joinedRoom.onStateChange(syncPlayerIds);
        syncPlayerIds(initialState);
        joinedRoom.onLeave(() => setConnectionState("disconnected"));
        joinedRoom.onError(() => setConnectionState("error"));
      } catch (error) {
        console.error(error);
        if (!cancelled) setConnectionState("error");
      }
    };

    void connect();
    return () => {
      cancelled = true;
      roomRef.current = null;
      if (joinedRoom) void joinedRoom.leave();
    };
  }, []);

  return (
    <main className="game-shell">
      <header className="hud">
        <div>
          <p className="eyebrow">STRUCTURE TEST / 3D FOUNDATION</p>
          <h1>ガヤでスプラトゥーン</h1>
        </div>
        <div className={`status status--${connectionState}`}>
          <span />
          {connectionState === "connected"
            ? `接続中 · ${playerIds.length}/8人`
            : connectionState === "connecting"
              ? "サーバーへ接続中"
              : "サーバー未接続"}
        </div>
      </header>

      <section
        className="viewport"
        onContextMenu={(event) => event.preventDefault()}
      >
        <Canvas
          shadows
          camera={{ fov: 55, near: 0.1, far: 100, position: [0, 7, 9] }}
          fallback={<p className="webgl-error">WebGLを利用できません。</p>}
        >
          <Suspense fallback={null}>
            <GameScene roomRef={roomRef} playerIds={playerIds} />
          </Suspense>
        </Canvas>
        <div className="crosshair" aria-hidden="true" />
        <aside className="controls">
          <strong>操作</strong>
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> 移動
          </span>
          <span>クリック → マウスで視点回転</span>
          <span>
            <kbd>Esc</kbd> マウス解除
          </span>
        </aside>
      </section>
    </main>
  );
}
