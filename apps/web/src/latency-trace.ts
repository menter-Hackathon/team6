import { lastVoiceOnset } from "./speech/voice-feedback";

/**
 * Measures how long a gaya takes from voice onset to visible paint.
 * Timestamps only (no audio); logs one line per fired reaction.
 * Enabled in dev builds, or with `?latency` in the URL.
 */
export type LatencyStage = "interim" | "final" | "classified" | "sent" | "echo";

interface Trace {
  onset?: number;
  text?: string;
  level?: string;
  via?: "interim" | "final";
  stamps: Partial<Record<LatencyStage, number>>;
}

export interface LatencyRecord {
  text: string;
  level: string;
  via: string;
  /** Milliseconds from voice onset (or first stamp) to each stage. */
  ms: Partial<Record<LatencyStage, number>>;
}

const ENABLED =
  import.meta.env.DEV ||
  (typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("latency"));
const MAX_TRACES = 200;
const MAX_HISTORY = 100;
/** An onset older than this is unrelated to the utterance being traced. */
const ONSET_WINDOW_MS = 10_000;

const traces = new Map<string, Trace>();
const history: LatencyRecord[] = [];
const inkRtts: number[] = [];
let unconfirmed = 0;
let forks = 0;

function get(key: string, now: number): Trace {
  let trace = traces.get(key);
  if (!trace) {
    const onset = lastVoiceOnset();
    trace = {
      stamps: {},
      ...(now - onset <= ONSET_WINDOW_MS ? { onset } : {}),
    };
    traces.set(key, trace);
    while (traces.size > MAX_TRACES) traces.delete(traces.keys().next().value!);
  }
  return trace;
}

export function traceStage(
  key: string | undefined,
  stage: LatencyStage,
  info: { text?: string; level?: string; via?: "interim" | "final" } = {},
  now = performance.now(),
): void {
  if (!ENABLED || !key) return;
  const trace = get(key, now);
  trace.stamps[stage] ??= now;
  if (info.text) trace.text = info.text;
  if (info.level) trace.level = info.level;
  if (info.via) trace.via ??= info.via;
}

/** One utterance can fire several reactions (はいはい); each gets its own copy. */
export function forkTrace(key: string): string | undefined {
  if (!ENABLED) return undefined;
  const fork = `${key}#${++forks}`;
  const source = traces.get(key);
  if (source) traces.set(fork, { ...source, stamps: { ...source.stamps } });
  return fork;
}

export function finishTrace(key: string | undefined): void {
  if (!ENABLED || !key) return;
  const trace = traces.get(key);
  traces.delete(key);
  if (!trace) return;
  const times = Object.values(trace.stamps);
  const origin = trace.onset ?? Math.min(...times);
  const ms: LatencyRecord["ms"] = {};
  for (const [stage, at] of Object.entries(trace.stamps))
    ms[stage as LatencyStage] = Math.round(at - origin);
  const record: LatencyRecord = {
    text: trace.text ?? "",
    level: trace.level ?? "",
    via:
      trace.via === "interim"
        ? "途中認識"
        : trace.via === "final"
          ? "確定"
          : "",
    ms,
  };
  history.push(record);
  if (history.length > MAX_HISTORY) history.shift();
  const show = (label: string, stage: LatencyStage) =>
    ms[stage] === undefined ? `${label} —` : `${label} +${ms[stage]}ms`;
  console.info(
    `[反応速度] 「${record.text}」→${record.level}${record.via ? `（${record.via}で判定）` : ""}` +
      ` ${trace.onset === undefined ? "起点=最初の記録" : "起点=声の立ち上がり"} | ` +
      [
        show("途中認識", "interim"),
        show("確定", "final"),
        show("判定", "classified"),
        show("送信", "sent"),
        show("サーバー返信", "echo"),
      ].join(" | "),
  );
}

export function recordInkRoundTrip(ms: number): void {
  if (!ENABLED || !Number.isFinite(ms)) return;
  inkRtts.push(ms);
  if (inkRtts.length > MAX_HISTORY) inkRtts.shift();
}

export function recordUnconfirmedShot(): void {
  if (ENABLED) unconfirmed++;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)]!);
}

export function latencySummary() {
  const stage = (name: LatencyStage) =>
    median(
      history.flatMap((record) =>
        record.ms[name] === undefined ? [] : [record.ms[name]!],
      ),
    );
  return {
    reactions: history.length,
    medianMs: {
      interim: stage("interim"),
      final: stage("final"),
      classified: stage("classified"),
      sent: stage("sent"),
      echo: stage("echo"),
    },
    inkRoundTripMedianMs: median(inkRtts),
    inkShotsMeasured: inkRtts.length,
    unconfirmedPredictedShots: unconfirmed,
  };
}

if (ENABLED && typeof window !== "undefined")
  Object.assign(window, {
    gayaLatency: { summary: latencySummary, history },
  });
