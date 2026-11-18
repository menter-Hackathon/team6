import { Canvas } from "@react-three/fiber";
import { Client, type Room } from "@colyseus/sdk";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  GAME_ROOM_NAME,
  NEON_COLORS,
  PAINT_GRID_SIZE,
  countPaintedCells,
  STARTABLE_PLAYER_COUNTS,
  TURN_INTRO_MS,
  type SpecialShape,
  speakerTeamAreaMultiplier,
} from "@gaya/shared";
import type { GameState } from "./game-types";
import { GameScene } from "./game-scene";
import { ProgressionPopup, type PopupScene } from "./progression-popup";
import { TurnFlow } from "./turn-flow";
import { ResultFlow } from "./result-flow";
import { RoomSummary } from "./room-summary";
import { TeamSelection } from "./team-selection";
import { TeamColorPicker } from "./team-color-picker";
import { DevMatchFlow, type DevMatchPhase, type DevMatchTurn } from "./dev-match-flow";

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
  const [specialShape, setSpecialShape] = useState<SpecialShape>("star");
  const [devColorA, setDevColorA] = useState<string>(NEON_COLORS[0]!.hex);
  const [devColorB, setDevColorB] = useState<string>(NEON_COLORS[1]!.hex);
  const [devTeam, setDevTeam] = useState<"A" | "B">("A");
  const devPaintCells = useRef<Uint8Array | null>(null);
  const [devResult, setDevResult] = useState<{
    cells: Uint8Array;
    scoreA: number;
    scoreB: number;
  } | null>(null);
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
  const [devMatchActive, setDevMatchActive] = useState(false);
  const [devMatchCount, setDevMatchCount] = useState(4);
  const [devMatchTurn, setDevMatchTurn] = useState<DevMatchTurn | null>(null);
  const [devMatchPhase, setDevMatchPhase] = useState<DevMatchPhase>("lobby");
  const [devTeamOffset, setDevTeamOffset] = useState(0);
  const [showTopicPopup, setShowTopicPopup] = useState(true);
  const syncDevTeamOffset = useCallback((offset: number) => {
    setDevTeamOffset(offset);
    setDevTeam(offset % 2 === 0 ? "A" : "B");
  }, []);

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
      setShowTopicPopup(true);
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
    setDevResult(null);
    setDevMatchActive(false);
    setDevMatchTurn(null);
    setDevMatchPhase("lobby");
    setDevTeamOffset(0);
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
    (gameState?.replayPlayerCount === 0 || players.length === gameState?.replayPlayerCount) &&
    players.every((player) => player.ready);
  const canReplay =
    gameState?.hostId === roomRef.current?.sessionId &&
    STARTABLE_PLAYER_COUNTS.some((count) => count === players.length) &&
    players.filter((player) => player.team === "A").length === players.length / 2 &&
    players.filter((player) => player.team === "B").length === players.length / 2;
  const devSpeakerBlocked =
    devMatchActive && devMatchTurn?.isYourTurn === true;
  const devMatchCanPaint =
    !devMatchActive ||
    devMatchPhase === "lobby" ||
    (devMatchPhase === "playing" && devMatchTurn !== null && !devSpeakerBlocked);
  const devAreaMultiplier =
    devMatchActive &&
    devMatchTurn &&
    devMatchTurn.speakerTeam === devTeam &&
    !devSpeakerBlocked
      ? speakerTeamAreaMultiplier(devMatchTurn.count / 2)
      : 1;

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
            <li>Q・E：塗り分け / Esc：視点回転を解除</li>
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
          <div className="dev-team-picker" role="group" aria-label="塗るチーム">
            <span>試すチーム：</span>
            <button
              aria-pressed={devTeam === "A"}
              onClick={() => setDevTeam("A")}
            >
              A
            </button>
            <button
              aria-pressed={devTeam === "B"}
              onClick={() => setDevTeam("B")}
            >
              B
            </button>
          </div>
          {devMatchActive && devMatchTurn && (
            <p role="status">
              {devSpeakerBlocked
                ? "あなたの発表中：塗り停止"
                : `現在の塗り面積：${devAreaMultiplier === 1 ? "補正なし" : `${devAreaMultiplier.toFixed(2)}倍`}`}
            </p>
          )}
          <h3>進行ポップアップを確認</h3>
          <button
            onClick={() => {
              setPreviewPopup(null);
              setDevMatchActive(true);
            }}
          >
            開始から結果まで通して検証
          </button>
          <div className="popup-preview-buttons">
            {(["lobby", "countdown", "turn", "result"] as const).map(
              (scene) => (
                <button
                  key={scene}
                  onClick={() => {
                    if (scene === "result") {
                      const cells =
                        devPaintCells.current?.slice() ??
                        new Uint8Array(PAINT_GRID_SIZE ** 2);
                      setDevResult({ cells, ...countPaintedCells(cells) });
                    }
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
        <div className="game-canvas-layer">
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
              devComCount={devMatchActive ? devMatchCount - 1 : 0}
              devMatchPhase={devMatchActive ? devMatchPhase : undefined}
              devTeamOffset={devTeamOffset}
              devTeam={devTeam}
              devAreaMultiplier={devAreaMultiplier}
              devCanMove={!devMatchActive || devMatchPhase === "lobby" || devMatchPhase === "playing"}
              devCanPaint={devMatchCanPaint}
              devPaintCells={devPaintCells}
              specialShape={specialShape}
              colorA={devMode ? devColorA : gameState?.colorA}
              colorB={devMode ? devColorB : gameState?.colorB}
            />
          </Suspense>
        </Canvas>
        </div>
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
          <span>Space: ジャンプ / Q: リング / E: 直線で塗る</span>
          <span>F: 回転ジャンプ → 着地で広範囲を塗る</span>
          <span>
            <kbd>Esc</kbd> マウス解除
          </span>
        </aside>
        {devMode && devMatchActive && (
          <DevMatchFlow
            cells={devPaintCells}
            colorA={devColorA}
            colorB={devColorB}
            onCountChange={setDevMatchCount}
            onTurnChange={setDevMatchTurn}
            onPhaseChange={setDevMatchPhase}
            onTeamOffsetChange={syncDevTeamOffset}
            onColorSelect={(team, color) => {
              if (team === "A") setDevColorA(color);
              else setDevColorB(color);
            }}
            onClose={() => {
              setDevMatchActive(false);
              setDevMatchTurn(null);
              setDevMatchPhase("lobby");
              setDevTeamOffset(0);
            }}
          />
        )}
        {devMode && !devMatchActive && previewPopup === "turn" && (
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
        {devMode && !devMatchActive && previewPopup === "result" && (
          <ResultFlow
            scoreA={devResult?.scoreA ?? 0}
            scoreB={devResult?.scoreB ?? 0}
            {...(devResult ? { cells: devResult.cells } : {})}
            colorA={devColorA}
            colorB={devColorB}
            preview
            onClose={() => setPreviewPopup(null)}
          />
        )}
        {devMode &&
          !devMatchActive &&
          previewPopup &&
          previewPopup !== "turn" &&
          previewPopup !== "result" &&
          !(previewPopup === "lobby" && previewReady) && (
            <ProgressionPopup
              scene={previewPopup}
              preview
              players={[
                { displayName: "あなた", ready: previewReady },
                { displayName: "メンターA", ready: true },
                { displayName: "メンターB", ready: false },
                { displayName: "メンターC", ready: true },
              ]}
              isHost
              isReady={previewReady}
              speakerName="メンターA"
              onClose={() => setPreviewPopup(null)}
              onReady={() => setPreviewReady(true)}
              onStart={() => setPreviewPopup("countdown")}
            />
          )}
        {devMode &&
          !devMatchActive &&
          previewPopup === "lobby" &&
          previewReady && (
            <RoomSummary
              roomCode="ABCD12"
              names={["あなた", "メンターA", "メンターB", "メンターC"]}
              ready
              readyCount={4}
              canStart
              onReady={() => setPreviewReady(false)}
              onStart={() => setPreviewPopup("countdown")}
              onClose={() => setPreviewPopup(null)}
            />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "lobby" &&
          showTopicPopup && (
            <ProgressionPopup
              scene="lobby"
              roomCode={roomCode}
              players={players.map((player) => ({
                displayName: player.displayName,
                ready: player.ready,
              }))}
              isHost={gameState.hostId === roomRef.current?.sessionId}
              isReady={localPlayer?.ready ?? false}
              canStart={canStart}
              requiredPlayerCount={gameState.replayPlayerCount}
              practiceColor={localPlayer?.practiceColor ?? "#ff4f8b"}
              onPracticeColorSelect={(color) => roomRef.current?.send("practice-color", color)}
              onClose={() => setShowTopicPopup(false)}
              onReady={() => {
                const nextReady = !localPlayer?.ready;
                roomRef.current?.send("ready", nextReady);
                if (nextReady) setShowTopicPopup(false);
              }}
              {...(gameState.hostId === roomRef.current?.sessionId
                ? { onStart: () => roomRef.current?.send("prepare-teams") }
                : {})}
            />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "lobby" &&
          !showTopicPopup && (
            <RoomSummary
              roomCode={roomCode}
              names={players.map((player) => player.displayName)}
              canStart={canStart}
              requiredPlayerCount={gameState.replayPlayerCount}
              practiceColor={localPlayer?.practiceColor ?? "#ff4f8b"}
              onPracticeColorSelect={(color) => roomRef.current?.send("practice-color", color)}
              ready={localPlayer?.ready ?? false}
              readyCount={players.filter((player) => player.ready).length}
              onReady={() => {
                const nextReady = !localPlayer?.ready;
                roomRef.current?.send("ready", nextReady);
                if (!nextReady) setShowTopicPopup(true);
              }}
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
              talkDuration={gameState.talkDuration}
              onTalkDurationSelect={(seconds) => roomRef.current?.send("talk-duration", seconds)}
              onColorSelect={(team, color) =>
                roomRef.current?.send("team-color", { team, color })
              }
              onReshuffle={() => roomRef.current?.send("reshuffle-teams")}
              onReturnToLobby={() => roomRef.current?.send("return-to-lobby")}
              canStart={players.length === gameState.speakerOrder.length && (gameState.replayPlayerCount === 0 || players.length === gameState.replayPlayerCount)}
              onStart={() => roomRef.current?.send("start")}
            />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "countdown" && (
            <ProgressionPopup scene="countdown" countdownEndsAt={gameState.countdownEndsAt} />
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
              talkDuration={gameState.talkDuration}
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
              {...(canReplay ? { onReplay: () => roomRef.current?.send("replay") } : {})}
              onClose={leaveRoom}
            />
          )}
      </section>
    </main>
  );
}
