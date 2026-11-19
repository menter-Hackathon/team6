import { Canvas } from "@react-three/fiber";
import { Client, type Room } from "@colyseus/sdk";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  GAME_ROOM_NAME,
  NEON_COLORS,
  PAINT_GRID_SIZE,
  countPaintedCells,
  canStartWithPlayers,
  TURN_INTRO_MS,
  type SpecialShape,
  speakerTeamAreaMultiplier,
  PRESENTATION_SECONDS,
} from "@gaya/shared";
import type { GameState } from "./game-types";
import { GameScene } from "./game-scene";
import { ProgressionPopup, type PopupScene } from "./progression-popup";
import { TurnFlow } from "./turn-flow";
import { ResultFlow } from "./result-flow";
import { RoomSummary } from "./room-summary";
import { EntryScreen } from "./entry-screen";
import { LobbyActions, LobbyColorButtons } from "./lobby-hud";
import {
  EMPTY_EPISODE_DRAFT,
  EpisodeInput,
  type EpisodeDraft,
} from "./episode-input";
import { TeamSelection } from "./team-selection";
import { TranscriptionPanel } from "./speech/transcription-panel";
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
  const captureMode = new URLSearchParams(location.search).has("capture");
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [showDevObstacles, setShowDevObstacles] = useState(false);
  const [autoFire, setAutoFire] = useState(!captureMode);
  // D-086: the star/heart picker stays hidden; the special always lands as ink.
  const specialShape: SpecialShape = "ink";
  const [episodeDraft, setEpisodeDraft] =
    useState<EpisodeDraft>(EMPTY_EPISODE_DRAFT);
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
  const [talkDuration, setTalkDuration] = useState(PRESENTATION_SECONDS);
  const [devMatch, setDevMatch] = useState(false);
  const [speakerPreview, setSpeakerPreview] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  // A story belongs to one room; start fresh when the room changes.
  useEffect(() => setEpisodeDraft(EMPTY_EPISODE_DRAFT), [roomCode]);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewPopup, setPreviewPopup] = useState<PopupScene | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [devMatchActive, setDevMatchActive] = useState(false);
  const [devMatchCount, setDevMatchCount] = useState(4);
  const [devMatchTurn, setDevMatchTurn] = useState<DevMatchTurn | null>(null);
  const [devMatchPhase, setDevMatchPhase] = useState<DevMatchPhase>("lobby");
  const [devTeamOffset, setDevTeamOffset] = useState(0);
  const [showTopicPopup, setShowTopicPopup] = useState(true);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
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
            talkDuration,
            devMatch,
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
    canStartWithPlayers(players.length, gameState?.devMatch ?? false) &&
    (gameState?.replayPlayerCount === 0 || players.length === gameState?.replayPlayerCount) &&
    players.every((player) => player.ready);
  const canReplay =
    gameState?.hostId === roomRef.current?.sessionId &&
    canStartWithPlayers(players.length, gameState?.devMatch ?? false) &&
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

  // D-090: one story field, shown in whichever lobby view is open.
  const episodeInput = (
    <EpisodeInput
      draft={episodeDraft}
      onDraftChange={setEpisodeDraft}
      saved={localPlayer?.hasEpisode ?? false}
      enteredCount={players.filter((player) => player.hasEpisode).length}
      playerCount={players.length}
      onSave={(text) => roomRef.current?.send("episode", text)}
    />
  );

  return (
    <main className={`game-shell${captureMode ? " game-shell--capture" : ""}${panelsHidden ? " game-shell--panels-hidden" : ""}`}>
      <header className="hud">
        <div>
          <p className="eyebrow">GAYA SPLATOON / PARTY GAME</p>
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
        <button
          type="button"
          className="hud-dev-button"
          onClick={(event) => { setPanelsHidden(true); event.currentTarget.blur(); }}
        >
          操作パネルを隠す
        </button>
        <button className="hud-dev-button" onClick={toggleDevMode}>
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
      {panelsHidden && !captureMode && (
        <button
          type="button"
          className="panels-restore-button"
          onClick={(event) => { setPanelsHidden(false); event.currentTarget.blur(); }}
        >
          操作パネルを表示
        </button>
      )}

      {!devMode && connectionState !== "connected" ? (
        <EntryScreen
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          turnOrder={turnOrder}
          onTurnOrderChange={setTurnOrder}
          talkDuration={talkDuration}
          onTalkDurationChange={setTalkDuration}
          devMatch={devMatch}
          onDevMatchChange={setDevMatch}
          inviteCode={inviteCode}
          onInviteCodeChange={(code) => {
            setInviteCode(code);
            setFromInviteLink(false);
          }}
          fromInviteLink={fromInviteLink}
          connecting={connectionState === "connecting"}
          errorMessage={errorMessage}
          onCreate={() => void connect(true)}
          onJoin={() => void connect(false)}
        />
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
          <div className="dev-speaker-preview">
            <strong>発表中の演出</strong>
            <div>
              <button
                type="button"
                onClick={() => {
                  const next = !speakerPreview;
                  setSpeakerPreview(next);
                  window.dispatchEvent(new CustomEvent("speaker-preview", { detail: next }));
                }}
              >
                {speakerPreview ? "プレビューを止める" : "自分を発表者にする"}
              </button>
              <button
                type="button"
                disabled={!speakerPreview}
                onClick={() => window.dispatchEvent(new CustomEvent("speaker-preview-gaya", { detail: "fan" }))}
              >
                相槌のガヤ
              </button>
              <button
                type="button"
                disabled={!speakerPreview}
                onClick={() => window.dispatchEvent(new CustomEvent("speaker-preview-gaya", { detail: "slam" }))}
              >
                長い文章のガヤ
              </button>
              <button
                type="button"
                disabled={!speakerPreview}
                onClick={() => {
                  for (let i = 0; i < 14; i++)
                    window.setTimeout(
                      () =>
                        window.dispatchEvent(
                          new CustomEvent("speaker-preview-gaya", { detail: i % 4 === 3 ? "slam" : "fan" }),
                        ),
                      i * 350,
                    );
                }}
              >
                ガヤ連打（5秒）
              </button>
            </div>
          </div>
          <label className="dev-obstacle-toggle">
            <input
              type="checkbox"
              checked={showDevObstacles}
              onChange={(event) => setShowDevObstacles(event.target.checked)}
            />
            追加の検証用の箱を表示（4つ）
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
            布を通常インクで塗り、Shift＋テーブル方向への移動で天板に登れます。布・天板にも塗りが残ります。
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
              autoFire={autoFire}
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
        {devMode && (
          <>
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
          </>
        )}
        <div className="crosshair" aria-hidden="true" />
        {devMode && (
          <output
            id="dev-readout"
            className="dev-readout"
            aria-label="検証用座標"
          />
        )}
        <aside className={`controls${controlsCollapsed ? " controls--collapsed" : ""}`} aria-label="操作ガイド">
          <button className="controls-toggle" type="button" aria-expanded={!controlsCollapsed} aria-controls="controls-details" onClick={() => setControlsCollapsed((value) => !value)}>
            <strong>操作ガイド</strong><span aria-hidden="true">{controlsCollapsed ? "＋" : "－"}</span>
          </button>
          {!controlsCollapsed && <div id="controls-details" className="controls-details">
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> <span>移動</span>
          </span>
          <span><kbd>クリック</kbd> 視点回転・長押しでインク</span>
          <span><kbd>Shift</kbd> 潜航 <kbd>Space</kbd> ジャンプ</span>
          <span><kbd>Q</kbd> リング <kbd>E</kbd> 直線</span>
          <span><kbd>F</kbd> インクスラム</span>
          <span><kbd>Esc</kbd> マウス解除</span>
          </div>}
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
              requiredPlayerCount={gameState.replayPlayerCount}
              canStart={canStart}
              {...(gameState.hostId === roomRef.current?.sessionId
                ? { onStart: () => roomRef.current?.send("prepare-teams") }
                : {})}
            />
          )}
        {!devMode &&
          connectionState === "connected" &&
          gameState?.phase === "lobby" && (
            <>
              <LobbyColorButtons
                color={localPlayer?.practiceColor ?? "#ff4f8b"}
                onSelect={(color) => roomRef.current?.send("practice-color", color)}
              />
              <LobbyActions
                episodeInput={episodeInput}
                episodeDone={localPlayer?.hasEpisode ?? false}
                isReady={localPlayer?.ready ?? false}
                readyCount={players.filter((player) => player.ready).length}
                playerCount={Math.max(gameState.replayPlayerCount, players.length)}
                onReady={() => roomRef.current?.send("ready", !localPlayer?.ready)}
              />
            </>
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
