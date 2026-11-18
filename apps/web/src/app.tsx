import { Canvas } from "@react-three/fiber";
import { Client, type Room } from "@colyseus/sdk";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  GAME_ROOM_NAME,
  NEON_COLORS,
  STARTABLE_PLAYER_COUNTS,
  TURN_INTRO_MS,
} from "@gaya/shared";
import type { GameState } from "./game-types";
import { GameScene } from "./game-scene";
import { ProgressionPopup, type PopupScene } from "./progression-popup";
import { TurnFlow } from "./turn-flow";
import { ResultFlow } from "./result-flow";
import { RoomSummary } from "./room-summary";
import { TeamSelection } from "./team-selection";
import { TranscriptionPanel } from "./speech/transcription-panel";
import { TeamColorPicker } from "./team-color-picker";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.VITE_SERVER_HOST
    ? `https://${import.meta.env.VITE_SERVER_HOST}`
    : import.meta.env.DEV
      ? "http://localhost:2567"
      : "");

export function App() {
  const [showDevObstacles, setShowDevObstacles] = useState(true);
  const [autoFire, setAutoFire] = useState(true);
  const [devColorA, setDevColorA] = useState<string>(NEON_COLORS[0]!.hex);
  const [devColorB, setDevColorB] = useState<string>(NEON_COLORS[1]!.hex);
  const [devMode, setDevMode] = useState(() =>
    new URLSearchParams(location.search).has("dev"),
  );
  const roomRef = useRef<Room<GameState> | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState(
    () =>
      new URLSearchParams(location.search).get("room")?.trim().toUpperCase() ??
      "",
  );
  const [fromInviteLink, setFromInviteLink] = useState(() =>
    new URLSearchParams(location.search).has("room"),
  );
  const [turnOrder, setTurnOrder] = useState("alternating");
  const [roomCode, setRoomCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [previewPopup, setPreviewPopup] = useState<PopupScene | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

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
      const url = new URL(location.href);
      url.searchParams.delete("room");
      history.replaceState(null, "", url);
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
    setPreviewPopup(null);
    setPreviewReady(false);
  };

  const leaveRoom = () => {
    if (roomRef.current) void roomRef.current.leave();
    roomRef.current = null;
    setGameState(null);
    setPlayerIds([]);
    setRoomCode("");
    setConnectionState("disconnected");
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
        <TranscriptionPanel
          roomId={
            connectionState === "connected" && roomCode ? roomCode : undefined
          }
          userNames={
            players.length
              ? players.map((player) => player.displayName)
              : [displayName].filter(Boolean)
          }
        />
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
            onChange={(event) => {
              setInviteCode(event.target.value);
              setFromInviteLink(false);
            }}
          />
          {fromInviteLink && inviteCode && (
            <p>
              参加リンクからルーム {inviteCode}{" "}
              を開きました。表示名を入力して参加してください。
            </p>
          )}
          <button
            disabled={
              !displayName.trim() ||
              !inviteCode.trim() ||
              connectionState === "connecting"
            }
            onClick={() => void connect(false)}
          >
            {fromInviteLink ? "参加リンクから参加" : "コードで参加"}
          </button>
          {errorMessage && <p role="alert">{errorMessage}</p>}
        </section>
      ) : !devMode &&
        gameState?.phase !== "lobby" &&
        gameState?.phase !== "countdown" &&
        gameState?.phase !== "team_selection" ? (
        <section className="lobby-panel">
          <strong>招待コード: {roomCode}</strong>
          {gameState?.phase !== "result" && (
            <p>
              陣地 A: {gameState?.scoreA ?? 0} · B: {gameState?.scoreB ?? 0}
            </p>
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
        </section>
      ) : devMode ? (
        <details className="lobby-panel lobby-panel--dev" open>
          <summary className="dev-panel-summary">
            <h2>開発者用 検証モード</h2>
          </summary>
          <p>サーバーに接続せずに操作を確認できます。</p>
          <label className="dev-obstacle-toggle">
            <input
              type="checkbox"
              checked={showDevObstacles}
              onChange={(event) => setShowDevObstacles(event.target.checked)}
            />
            障害物を表示（4つの箱）
          </label>
          <button
            onClick={(event) => {
              window.dispatchEvent(new Event("dev-obstacle-start"));
              event.currentTarget.blur();
            }}
          >
            箱の前へ移動
          </button>
          <p className="dev-obstacle-note">
            壁を通常インクで塗り、Shift＋壁方向への移動で上に登れます。側面・上面にも塗りが残ります（検証モード限定）。
          </p>
          <ul className="dev-controls-list">
            <li>WASD・矢印キー：移動</li>
            <li>クリック：視点回転／長押しでインク発射</li>
            <li>Shift：潜航 / Space：ジャンプ</li>
            <li>
              1・F：回転ジャンプ / 2：扇状 / 3：通常 / 4：除外（塗らない） /
              Esc：視点回転を解除
            </li>
          </ul>
          <p>座標と向きは画面左下に表示します。</p>
          <TeamColorPicker
            colorA={devColorA}
            colorB={devColorB}
            editable
            onSelect={(team, color) => {
              if (team === "A") setDevColorA(color);
              else setDevColorB(color);
            }}
          />
          <h3>進行ポップアップを確認</h3>
          <div className="popup-preview-buttons">
            {(["lobby", "countdown", "turn", "result"] as const).map(
              (scene) => (
                <button
                  key={scene}
                  onClick={() => {
                    setPreviewPopup(scene);
                    setPreviewReady(false);
                  }}
                >
                  {
                    {
                      lobby: "入室待ち",
                      countdown: "ゲーム開始",
                      turn: "発表ターン",
                      result: "試合結果",
                    }[scene]
                  }
                </button>
              ),
            )}
          </div>
        </details>
      ) : null}

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
              showDevObstacles={showDevObstacles}
              specialShape="ink"
              autoFire={autoFire}
              colorA={devMode ? devColorA : gameState?.colorA}
              colorB={devMode ? devColorB : gameState?.colorB}
            />
          </Suspense>
        </Canvas>
        <button
          className="auto-fire-toggle"
          aria-label="通常インクの常時発射"
          aria-pressed={autoFire}
          onClick={() => setAutoFire((active) => !active)}
        >
          <span aria-hidden="true">{autoFire ? "●" : "○"}</span>{" "}
          通常インク常時発射：{autoFire ? "ON" : "OFF"}
        </button>
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
          <span>Space: ジャンプ / Q: リング / E: 直線で塗る</span>
          <span>F: 回転ジャンプ → 着地で広範囲を塗る</span>
          <span>
            <kbd>Esc</kbd> マウス解除
          </span>
        </aside>
        {devMode && previewPopup === "turn" && (
          <TurnFlow
            key="preview-turn"
            speakerName="あなた"
            isYourTurn
            turnNumber={1}
            turnCount={4}
            endsAt={Date.now() + TURN_INTRO_MS + 30_000}
            preview
            onClose={() => setPreviewPopup(null)}
          />
        )}
        {devMode && previewPopup === "result" && (
          <ResultFlow
            scoreA={1240}
            scoreB={980}
            colorA={devColorA}
            colorB={devColorB}
            preview
            onClose={() => setPreviewPopup(null)}
          />
        )}
        {devMode &&
          previewPopup &&
          previewPopup !== "turn" &&
          previewPopup !== "result" &&
          !(previewPopup === "lobby" && previewReady) && (
            <ProgressionPopup
              scene={previewPopup}
              preview
              players={[
                { displayName: "あなた", ready: true },
                { displayName: "メンターA", ready: true },
                { displayName: "メンターB", ready: false },
                { displayName: "メンターC", ready: true },
              ]}
              isHost
              isReady
              speakerName="メンターA"
              onClose={() => setPreviewPopup(null)}
              onReady={() => setPreviewReady(true)}
              onStart={() => setPreviewPopup("countdown")}
            />
          )}
        {devMode && previewPopup === "lobby" && previewReady && (
          <RoomSummary
            roomCode="ABCD12"
            names={["あなた", "メンターA", "メンターB", "メンターC"]}
            canStart
            onStart={() => setPreviewPopup("countdown")}
            onClose={() => setPreviewPopup(null)}
          />
        )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "lobby" && (
            <RoomSummary
              roomCode={roomCode}
              names={players.map((player) => player.displayName)}
              canStart={canStart}
              practiceColor={localPlayer?.practiceColor ?? "#ff4f8b"}
              onPracticeColorSelect={(color) =>
                roomRef.current?.send("practice-color", color)
              }
              ready={localPlayer?.ready ?? false}
              readyCount={players.filter((player) => player.ready).length}
              onReady={() =>
                roomRef.current?.send("ready", !localPlayer?.ready)
              }
              episodeSaved={localPlayer?.hasEpisode ?? false}
              episodeCount={
                players.filter((player) => player.hasEpisode).length
              }
              onEpisodeSave={(text) => roomRef.current?.send("episode", text)}
              {...(gameState.hostId === roomRef.current?.sessionId
                ? { onStart: () => roomRef.current?.send("prepare-teams") }
                : {})}
            />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "team_selection" && (
            <TeamSelection
              players={players}
              colorA={gameState.colorA}
              colorB={gameState.colorB}
              isHost={gameState.hostId === roomRef.current?.sessionId}
              onColorSelect={(team, color) =>
                roomRef.current?.send("team-color", { team, color })
              }
              onStart={() => roomRef.current?.send("start")}
            />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "countdown" && (
            <ProgressionPopup scene="countdown" />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "playing" &&
          gameState.turnIndex > 0 &&
          gameState.turnEndsAt > 0 && (
            <TurnFlow
              key={`turn-${gameState.turnIndex}`}
              speakerName={
                gameState.players.get(
                  gameState.speakerOrder[gameState.turnIndex - 1] ?? "",
                )?.displayName ?? "プレイヤー"
              }
              isYourTurn={
                gameState.speakerOrder[gameState.turnIndex - 1] ===
                roomRef.current?.sessionId
              }
              turnNumber={gameState.turnIndex}
              turnCount={gameState.speakerOrder.length}
              endsAt={gameState.turnEndsAt}
            />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "result" && (
            <ResultFlow
              scoreA={gameState.scoreA}
              scoreB={gameState.scoreB}
              colorA={gameState.colorA}
              colorB={gameState.colorB}
              {...(roomRef.current ? { room: roomRef.current } : {})}
              onClose={leaveRoom}
            />
          )}
      </section>
    </main>
  );
}
