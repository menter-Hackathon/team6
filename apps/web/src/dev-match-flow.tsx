import { useEffect, useState } from "react";
import {
  GAME_START_COUNTDOWN_SECONDS,
  PAINT_GRID_SIZE,
  PRESENTATION_SECONDS,
  STARTABLE_PLAYER_COUNTS,
  TURN_INTRO_MS,
  countPaintedCells,
} from "@gaya/shared";
import { ProgressionPopup } from "./progression-popup";
import { RoomSummary } from "./room-summary";
import { TeamSelection } from "./team-selection";
import { TurnFlow } from "./turn-flow";
import { ResultFlow } from "./result-flow";

type Phase = "lobby" | "team_selection" | "countdown" | "playing" | "result";

export interface DevMatchTurn {
  count: 4 | 6 | 8;
  speakerTeam: "A" | "B";
  isYourTurn: boolean;
}

interface Props {
  cells: React.RefObject<Uint8Array | null>;
  colorA: string;
  colorB: string;
  onColorSelect: (team: "A" | "B", color: string) => void;
  onCountChange: (count: number) => void;
  onTurnChange: (turn: DevMatchTurn | null) => void;
  onClose: () => void;
}

export function DevMatchFlow({
  cells,
  colorA,
  colorB,
  onColorSelect,
  onCountChange,
  onTurnChange,
  onClose,
}: Props) {
  const [count, setCount] = useState<4 | 6 | 8>(4);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [ready, setReady] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [resultCells, setResultCells] = useState<Uint8Array | null>(null);
  const [showLobby, setShowLobby] = useState(true);
  const [teamOffset, setTeamOffset] = useState(0);
  const [talkDuration, setTalkDuration] = useState(PRESENTATION_SECONDS);
  const players = Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "you" : `com-${index}`,
    displayName: index === 0 ? "あなた" : `COM ${index}`,
    team: ((index + teamOffset) % 2 === 0 ? "A" : "B") as "A" | "B",
    ready: index === 0 ? ready : true,
  }));

  useEffect(() => {
    onTurnChange(
      phase === "playing"
        ? {
            count,
            speakerTeam: turnIndex % 2 === 0 ? "A" : "B",
            isYourTurn: turnIndex === 0,
          }
        : null,
    );
  }, [phase, count, turnIndex, onTurnChange]);

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setTimeout(() => {
      setTurnIndex(0);
      setEndsAt(Date.now() + TURN_INTRO_MS + talkDuration * 1000);
      setPhase("playing");
    }, GAME_START_COUNTDOWN_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, talkDuration]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(
      () => {
        if (turnIndex + 1 >= count) {
          setResultCells(
            cells.current?.slice() ?? new Uint8Array(PAINT_GRID_SIZE ** 2),
          );
          setPhase("result");
        } else {
          setTurnIndex(turnIndex + 1);
          setEndsAt(Date.now() + TURN_INTRO_MS + talkDuration * 1000);
        }
      },
      Math.max(0, endsAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [phase, turnIndex, endsAt, count, cells, talkDuration]);

  const nextTurn = () => {
    if (turnIndex + 1 >= count) {
      setResultCells(
        cells.current?.slice() ?? new Uint8Array(PAINT_GRID_SIZE ** 2),
      );
      setPhase("result");
    } else {
      setTurnIndex(turnIndex + 1);
      setEndsAt(Date.now() + TURN_INTRO_MS + talkDuration * 1000);
    }
  };

  const restart = () => {
    window.dispatchEvent(new Event("dev-reset-paint"));
    setPhase("lobby");
    setReady(false);
    setShowLobby(true);
    setTurnIndex(0);
    setResultCells(null);
  };
  const startMatch = () => {
    window.dispatchEvent(new Event("dev-reset-paint"));
    setPhase("countdown");
  };

  return (
    <>
      <div className="dev-match-toolbar">
        <strong>
          一連の流れを検証 · {count}人（あなた + COM {count - 1}人）
        </strong>
        {phase === "lobby" && (
          <label>
            人数{" "}
            <select
              aria-label="検証する人数"
              value={count}
              onChange={(event) => {
                const next = Number(event.target.value) as 4 | 6 | 8;
                setCount(next);
                onCountChange(next);
                setReady(false);
                setShowLobby(true);
              }}
            >
              {STARTABLE_PLAYER_COUNTS.map((value) => (
                <option key={value} value={value}>
                  {value}人
                </option>
              ))}
            </select>
          </label>
        )}
        {phase === "playing" && (
          <>
            <span>
              発表側: {players[turnIndex]!.team} · {count / 2}対{count / 2}
              {turnIndex === 0 ? " · あなたは塗れません" : ""}
            </span>
            <button onClick={nextTurn}>次の発表へ進む</button>
          </>
        )}
        <button onClick={onClose}>検証を終了</button>
      </div>
      {phase === "lobby" && showLobby && (
        <ProgressionPopup
          scene="lobby"
          preview
          players={players}
          isHost
          isReady={ready}
          canStart={ready}
          onReady={() => {
            setReady((value) => !value);
            setShowLobby(false);
          }}
          onStart={() => setPhase("team_selection")}
          onClose={() => setShowLobby(false)}
        />
      )}
      {phase === "lobby" && !showLobby && (
        <RoomSummary
          roomCode="TEST"
          names={players.map((player) => player.displayName)}
          ready={ready}
          readyCount={players.filter((player) => player.ready).length}
          canStart={ready}
          onReady={() => setReady((value) => !value)}
          onStart={() => setPhase("team_selection")}
          onClose={() => setShowLobby(true)}
        />
      )}
      {phase === "team_selection" && (
        <TeamSelection
          players={players}
          colorA={colorA}
          colorB={colorB}
          isHost
          talkDuration={talkDuration}
          onTalkDurationSelect={setTalkDuration}
          onColorSelect={onColorSelect}
          onReshuffle={() => setTeamOffset((value) => value + 1)}
          onStart={startMatch}
        />
      )}
      {phase === "countdown" && <ProgressionPopup scene="countdown" />}
      {phase === "playing" && (
        <TurnFlow
          key={turnIndex}
          speakerName={players[turnIndex]!.displayName}
          isYourTurn={turnIndex === 0}
          turnNumber={turnIndex + 1}
          turnCount={count}
          endsAt={endsAt}
          talkDuration={talkDuration}
        />
      )}
      {phase === "result" && resultCells && (
        <ResultFlow
          key={resultCells.byteLength + turnIndex}
          {...countPaintedCells(resultCells)}
          cells={resultCells}
          colorA={colorA}
          colorB={colorB}
          onReplay={restart}
          onClose={onClose}
        />
      )}
    </>
  );
}
