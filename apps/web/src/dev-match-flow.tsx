import { useCallback, useEffect, useState } from "react";
import {
  GAME_START_COUNTDOWN_SECONDS,
  PAINT_GRID_SIZE,
  PRESENTATION_SECONDS,
  DEV_STARTABLE_PLAYER_COUNTS,
  type RoomPlayerCount,
  TURN_INTRO_MS,
  countPaintedCells,
  pickRandomTopics,
} from "@gaya/shared";
import { ProgressionPopup } from "./progression-popup";
import { RoomSummary } from "./room-summary";
import { TeamSelection } from "./team-selection";
import { TurnFlow } from "./turn-flow";
import { EpisodeInput, EMPTY_EPISODE_DRAFT } from "./episode-input";
import { LobbyActions } from "./lobby-hud";
import { ResultFlow } from "./result-flow";
import { WaitingRoom } from "./waiting-room";

export type DevMatchPhase =
  "lobby" | "team_selection" | "countdown" | "playing" | "result";

export interface DevMatchTurn {
  count: RoomPlayerCount;
  speakerTeam: "A" | "B";
  isYourTurn: boolean;
  speakerIndex: number;
  turnNumber: number;
  topic: string;
}

interface Props {
  microphoneListening: boolean;
  microphoneChanging: boolean;
  onStartMicrophone: () => void;
  cells: React.RefObject<Uint8Array | null>;
  colorA: string;
  colorB: string;
  onColorSelect: (team: "A" | "B", color: string) => void;
  onCountChange: (count: number) => void;
  onTurnChange: (turn: DevMatchTurn | null) => void;
  onPhaseChange: (phase: DevMatchPhase) => void;
  onTeamsChange: (teams: readonly ("A" | "B")[]) => void;
  onOpenWardrobe: () => void;
  onClose: () => void;
}

export function DevMatchFlow({
  microphoneListening,
  microphoneChanging,
  onStartMicrophone,
  cells,
  colorA,
  colorB,
  onColorSelect,
  onCountChange,
  onTurnChange,
  onPhaseChange,
  onTeamsChange,
  onOpenWardrobe,
  onClose,
}: Props) {
  const [count, setCount] = useState<RoomPlayerCount>(4);
  const [phase, setPhase] = useState<DevMatchPhase>("lobby");
  const [ready, setReady] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [resultCells, setResultCells] = useState<Uint8Array | null>(null);
  const [showLobby, setShowLobby] = useState(true);
  const [episodeOpen, setEpisodeOpen] = useState(false);
  const [episode, setEpisode] = useState(EMPTY_EPISODE_DRAFT);
  const [topics] = useState(() => pickRandomTopics(7));
  const [teams, setTeams] = useState<("A" | "B")[]>([]);
  const [speakerOrder, setSpeakerOrder] = useState<number[]>([]);
  const [countdownEndsAt, setCountdownEndsAt] = useState(0);
  const [talkDuration, setTalkDuration] = useState(PRESENTATION_SECONDS);
  const players = Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "you" : `com-${index}`,
    displayName: index === 0 ? "あなた" : `COM ${index}`,
    team: teams[index] ?? (index % 2 === 0 ? "A" : "B"),
    ready: index === 0 ? ready : true,
  }));

  const speakerIndex = speakerOrder[turnIndex] ?? 0;
  const speaker = players[speakerIndex]!;
  const topic =
    speakerIndex === 0 ? (episode.savedText ?? "") : topics[speakerIndex - 1]!;
  const speakerTeam = speaker.team;
  useEffect(() => onPhaseChange(phase), [phase, onPhaseChange]);
  useEffect(() => onTeamsChange(teams), [teams, onTeamsChange]);

  useEffect(() => {
    onTurnChange(
      phase === "playing"
        ? {
            count,
            speakerTeam,
            isYourTurn: speakerIndex === 0,
            speakerIndex,
            turnNumber: turnIndex + 1,
            topic,
          }
        : null,
    );
  }, [phase, count, speakerTeam, speakerIndex, turnIndex, topic, onTurnChange]);

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setTimeout(
      () => {
        setTurnIndex(0);
        setEndsAt(Date.now() + TURN_INTRO_MS + talkDuration * 1000);
        setPhase("playing");
      },
      Math.max(0, countdownEndsAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [phase, countdownEndsAt, talkDuration]);

  const nextTurn = useCallback(() => {
    if (turnIndex + 1 >= count) {
      setResultCells(
        cells.current?.slice() ?? new Uint8Array(PAINT_GRID_SIZE ** 2),
      );
      setPhase("result");
    } else {
      setTurnIndex(turnIndex + 1);
      setEndsAt(Date.now() + TURN_INTRO_MS + talkDuration * 1000);
    }
  }, [turnIndex, count, cells, talkDuration]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(nextTurn, Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [phase, endsAt, nextTurn]);

  const assignTeams = () => {
    const order = Array.from({ length: count }, (_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const teamA = order.slice(0, count / 2);
    const teamB = order.slice(count / 2);
    const nextTeams = players.map((_, index) =>
      teamA.includes(index) ? ("A" as const) : ("B" as const),
    );
    if (nextTeams.every((team, index) => team === teams[index])) {
      const a = teamA[0]!;
      const b = teamB[0]!;
      teamA[0] = b;
      teamB[0] = a;
      nextTeams[a] = "B";
      nextTeams[b] = "A";
    }
    setTeams(nextTeams);
    setSpeakerOrder(teamA.flatMap((index, slot) => [index, teamB[slot]!]));
  };
  const prepareTeams = () => {
    if (!ready || !episode.savedText) return;
    assignTeams();
    setPhase("team_selection");
  };
  const toggleReady = () => {
    if (!ready && (!episode.savedText || !microphoneListening)) return;
    setReady(!ready);
    if (!ready) setShowLobby(false);
  };

  const restart = () => {
    window.dispatchEvent(new Event("dev-reset-paint"));
    setPhase("team_selection");
    setTurnIndex(0);
    setResultCells(null);
  };
  const startMatch = () => {
    window.dispatchEvent(new Event("dev-reset-paint"));
    setCountdownEndsAt(Date.now() + GAME_START_COUNTDOWN_SECONDS * 1000);
    setPhase("countdown");
  };

  return (
    <>
      <div className={`dev-match-toolbar dev-match-toolbar--${phase}`}>
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
                const next = Number(event.target.value) as RoomPlayerCount;
                setCount(next);
                onCountChange(next);
                setReady(false);
                setTeams([]);
                setShowLobby(true);
              }}
            >
              {DEV_STARTABLE_PLAYER_COUNTS.map((value) => (
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
              発表側: {speakerTeam} · {count / 2}対{count / 2}
              {count !== 2 && speakerIndex === 0 ? " · あなたは塗れません" : ""}
            </span>
            <button onClick={nextTurn}>次の発表へ進む</button>
          </>
        )}
        <button onClick={onClose}>検証を終了</button>
      </div>
      {phase === "lobby" && (
        <>
          {showLobby ? (
            <WaitingRoom
              roomCode="TEST"
              players={players}
              seatCount={count}
              requiredPlayerCount={0}
              episodeDone={Boolean(episode.savedText)}
              microphoneListening={microphoneListening}
              microphoneChanging={microphoneChanging}
              isReady={ready}
              isHost
              canStart={ready}
              startHint="準備OKにすると開始できます"
              onOpenEpisode={() => setEpisodeOpen(true)}
              onOpenWardrobe={onOpenWardrobe}
              onStartMicrophone={onStartMicrophone}
              onReady={toggleReady}
              onStart={prepareTeams}
              onClose={() => setShowLobby(false)}
            />
          ) : (
            <RoomSummary
              roomCode="TEST"
              localRoom
              names={players.map((player) => player.displayName)}
              canStart={ready}
              onOpenWardrobe={onOpenWardrobe}
              onStart={prepareTeams}
            />
          )}
          <LobbyActions
            episodeInput={
              <EpisodeInput
                draft={episode}
                onDraftChange={setEpisode}
                saved={Boolean(episode.savedText)}
                enteredCount={count - Number(!episode.savedText)}
                playerCount={count}
                onSave={(text) => {
                  if (!text) setReady(false);
                }}
              />
            }
            onSelectTopic={(text) =>
              setEpisode((draft) => ({ ...draft, text }))
            }
            episodeDone={Boolean(episode.savedText)}
            microphoneListening={microphoneListening}
            microphoneChanging={microphoneChanging}
            onStartMicrophone={onStartMicrophone}
            isReady={ready}
            readyCount={count - Number(!ready)}
            playerCount={count}
            onReady={toggleReady}
            episodeOpen={episodeOpen}
            onEpisodeOpenChange={setEpisodeOpen}
            episodeHasText={episode.text.trim().length > 0}
            showControls={!showLobby}
          />
        </>
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
          onReshuffle={assignTeams}
          onReturnToLobby={() => {
            setPhase("lobby");
            setReady(false);
            setShowLobby(true);
          }}
          onStart={startMatch}
        />
      )}
      {phase === "countdown" && (
        <ProgressionPopup scene="countdown" countdownEndsAt={countdownEndsAt} />
      )}
      {phase === "playing" && (
        <TurnFlow
          key={turnIndex}
          speakerName={speaker.displayName}
          topic={topic}
          isYourTurn={speakerIndex === 0}
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
