import { Canvas } from "@react-three/fiber";
import { Client, type Room } from "@colyseus/sdk";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  GAME_ROOM_NAME,
  STARTABLE_PLAYER_COUNTS,
  type SpecialShape,
} from "@gaya/shared";
import type { GameState } from "./game-types";
import { GameScene } from "./game-scene";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.VITE_SERVER_HOST
    ? `https://${import.meta.env.VITE_SERVER_HOST}`
    : import.meta.env.DEV
      ? "http://localhost:2567"
      : "");

export function App() {
  const [specialShape, setSpecialShape] = useState<SpecialShape>("star");
  const [devMode, setDevMode] = useState(() =>
    new URLSearchParams(location.search).has("dev"),
  );
  const roomRef = useRef<Room<GameState> | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [turnOrder, setTurnOrder] = useState("alternating");
  const [roomCode, setRoomCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const connect = async (create: boolean) => {
    if (!SERVER_URL) {
      setErrorMessage(
        "公開サイトのサーバー接続先が未設定です。Render の VITE_SERVER_HOST を確認してください。",
      );
      setConnectionState("error");
      return;
    }
    setConnectionState("connecting");
    setErrorMessage("");
    try {
      const client = new Client(SERVER_URL);
      const joinedRoom = create
        ? await client.create<GameState>(GAME_ROOM_NAME, {
            displayName,
            turnOrder,
          })
        : await client.joinById<GameState>(inviteCode.trim().toUpperCase(), {
            displayName,
          });
      const initialState = await new Promise<GameState>((resolve) => {
        joinedRoom.onStateChange.once(resolve);
      });
      roomRef.current = joinedRoom;
      setRoomCode(joinedRoom.roomId);
      setConnectionState("connected");
      const syncPlayerIds = (state: GameState) => {
        setPlayerIds(Array.from(state.players.keys()));
        setGameState(state);
      };
      joinedRoom.onStateChange(syncPlayerIds);
      syncPlayerIds(initialState);
      joinedRoom.onLeave(() => {
        setConnectionState("disconnected");
        roomRef.current = null;
      });
      joinedRoom.onError(() => setConnectionState("error"));
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "接続できませんでした。サーバーの起動状態と招待コードを確認してください。無料サーバーは起動に時間がかかる場合があります。",
      );
      setConnectionState("error");
    }
  };
  useEffect(() => {
    return () => {
      if (roomRef.current) void roomRef.current.leave();
    };
  }, []);

  const toggleDevMode = () => {
    const next = !devMode;
    if (next && roomRef.current) {
      void roomRef.current.leave();
      roomRef.current = null;
      setConnectionState("disconnected");
      setGameState(null);
      setPlayerIds([]);
      setRoomCode("");
    }
    const url = new URL(location.href);
    if (next) url.searchParams.set("dev", "");
    else url.searchParams.delete("dev");
    history.replaceState(null, "", url);
    setDevMode(next);
  };

  const players = gameState ? Array.from(gameState.players.values()) : [];
  const localPlayer = gameState?.players.get(roomRef.current?.sessionId ?? "");
  const canStart =
    gameState?.hostId === roomRef.current?.sessionId &&
    STARTABLE_PLAYER_COUNTS.some((count) => count === players.length) &&
    players.every((player) => player.ready);

  return (
    <main className="game-shell">
      <header className="hud">
        <div>
          <p className="eyebrow">STRUCTURE TEST / 3D FOUNDATION</p>
          <h1>ガヤでスプラトゥーン</h1>
        </div>
        <button onClick={toggleDevMode}>
          {devMode ? "検証モードを終了" : "操作を検証"}
        </button>
        <div className={`status status--${connectionState}`}>
          <span />
          {connectionState === "connected"
            ? `接続中 · ${playerIds.length}/8人`
            : connectionState === "connecting"
              ? "サーバーへ接続中"
              : connectionState === "error"
                ? "接続失敗"
                : "ルーム未参加"}
        </div>
      </header>

      {!devMode && connectionState !== "connected" ? (
        <section className="lobby-panel">
          <h2>ルームに参加</h2>
          <input
            aria-label="表示名"
            placeholder="表示名"
            maxLength={20}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <select
            aria-label="発表順"
            value={turnOrder}
            onChange={(event) => setTurnOrder(event.target.value)}
          >
            <option value="alternating">チーム交互</option>
            <option value="random">完全ランダム</option>
          </select>
          <button
            disabled={!displayName.trim() || connectionState === "connecting"}
            onClick={() => void connect(true)}
          >
            ルームを作る
          </button>
          <input
            aria-label="招待コード"
            placeholder="招待コード"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
          />
          <button
            disabled={
              !displayName.trim() ||
              !inviteCode.trim() ||
              connectionState === "connecting"
            }
            onClick={() => void connect(false)}
          >
            コードで参加
          </button>
          {errorMessage && <p role="alert">{errorMessage}</p>}
        </section>
      ) : !devMode ? (
        <section className="lobby-panel">
          <strong>招待コード: {roomCode}</strong>
          {gameState?.phase === "lobby" && (
            <p>待機中は移動できます。塗りは試合開始後に使えます。</p>
          )}
          <p>
            陣地 A: {gameState?.scoreA ?? 0} · B: {gameState?.scoreB ?? 0}
          </p>
          {gameState?.phase === "result" && (
            <strong>
              {gameState.scoreA === gameState.scoreB
                ? "引き分け"
                : `${gameState.scoreA > gameState.scoreB ? "A" : "B"} チームの勝ち`}
            </strong>
          )}
          <p>
            進行: {gameState?.phase}{" "}
            {gameState?.phase === "playing" &&
              `· 発表 ${gameState.turnIndex}/${gameState.speakerOrder.length}`}
          </p>
          <ul>
            {players.map((player) => (
              <li key={player.id}>
                {player.displayName} {player.team && `· ${player.team}`}{" "}
                {player.ready ? "✓ 準備完了" : ""}{" "}
                {player.id === gameState?.hostId ? "· 作成者" : ""}
              </li>
            ))}
          </ul>
          {gameState?.phase === "lobby" && (
            <>
              <button
                onClick={() =>
                  roomRef.current?.send("ready", !localPlayer?.ready)
                }
              >
                {localPlayer?.ready ? "準備を取り消す" : "準備完了"}
              </button>
              <button
                disabled={!canStart}
                onClick={() => roomRef.current?.send("start")}
              >
                試合開始
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="lobby-panel">
          <h2>開発者用 検証モード</h2>
          <p>サーバーに接続せず、移動・カメラ・塗りを確認できます。</p>
          <p>
            WASD・矢印キーで移動、クリック長押しでインク発射、Shift
            で潜航、Q・E・Space
            で塗り分け、フィールドをクリックして視点回転、Esc で解除。
          </p>
          <p>座標と向きは左下に表示します。</p>
        </section>
      )}

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
            <GameScene
              roomRef={roomRef}
              playerIds={devMode ? [] : playerIds}
              devMode={devMode}
              specialShape={specialShape}
            />
          </Suspense>
        </Canvas>
        <label className="special-shape-picker">
          着地のインク
          <select
            id="special-shape"
            aria-label="必殺技の塗り形"
            value={specialShape}
            onChange={(e) => setSpecialShape(e.target.value as SpecialShape)}
          >
            <option value="ink">● 通常インク</option>
            <option value="star">★ 星＋インク</option>
            <option value="heart">♥ ハート＋インク</option>
          </select>
        </label>
        <button
          id="special-button"
          className="special-button"
          onClick={() => window.dispatchEvent(new Event("activate-special"))}
        >
          F 必殺技 · インクスラム
        </button>
        <div className="crosshair" aria-hidden="true" />
        {devMode && (
          <output
            id="dev-readout"
            className="dev-readout"
            aria-label="検証用座標"
          />
        )}
        <aside className="controls">
          <strong>操作</strong>
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> / 矢印キー 移動
          </span>
          <span>クリック → マウスで視点回転 / 長押しでインク連射</span>
          <span>Shift: 自チームのインクに潜航（速度1.5倍）</span>
          <span>Q: リング / E: 直線 / Space: 扇形で塗る</span>
          <span>F: 回転ジャンプ → 着地で広範囲を塗る</span>
          <span>
            <kbd>Esc</kbd> マウス解除
          </span>
        </aside>
      </section>
    </main>
  );
}
