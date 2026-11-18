import { useEffect, useRef, useState } from "react";
import {
  reactionRequestSchema,
  type ReactionLevel,
  type ReactionSegment,
} from "@gaya/shared";
import { AizuchiStream, immediateAizuchiText } from "./aizuchi-stream";
import { createReactionClient } from "./reaction-client";
import type { Transcript } from "./protocol";

type Phase = "idle" | "loading" | "ready" | "error";
export type ReactionJudgment =
  | { state: "queued" | "classifying" | "failed" | "cancelled" }
  | { state: "done"; level: ReactionLevel; segments?: ReactionSegment[] };
interface Result {
  id: string;
  text: string;
  level: ReactionLevel;
  elapsedMs: number;
  segments: ReactionSegment[];
}
interface Job {
  id: string;
  text: string;
  fullText: string;
  prefixSegments: ReactionSegment[];
  source: string;
  userNames: string[];
}
const server =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.VITE_SERVER_HOST
    ? `https://${import.meta.env.VITE_SERVER_HOST}`
    : "");
const API = `${server.replace(/\/$/, "")}/api/reaction`;

export function useReactionClassification(
  enabled: boolean,
  registeredUserNames: readonly string[] = [],
) {
  const client = useRef(createReactionClient(API));
  const stream = useRef(new AizuchiStream());
  const [previewParts, setPreviewParts] = useState<ReactionSegment[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [source, setSource] = useState("");
  const [additionalUserNames, setAdditionalUserNames] = useState("");
  const userNames = [
    ...new Set(
      [...registeredUserNames, ...additionalUserNames.split(/[,、\n]/u)]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  const userNamesRef = useRef(userNames);
  userNamesRef.current = userNames;
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [judgments, setJudgments] = useState<Record<string, ReactionJudgment>>(
    {},
  );
  function updateJudgment(id: string, judgment: ReactionJudgment) {
    setJudgments((previous) =>
      Object.fromEntries(
        [
          ...Object.entries(previous).filter(([key]) => key !== id),
          [id, judgment],
        ].slice(-100),
      ),
    );
  }
  const sourceRef = useRef("");
  const active = useRef(false),
    generation = useRef(0);
  const jobs = useRef<Job[]>([]),
    busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const seen = useRef(new Set<string>());
  const submitRef = useRef<(text: string, id: string) => void>(() => {});
  function submit(text: string, id: string = crypto.randomUUID()) {
    if (!active.current || seen.current.has(id)) return;
    const pair = reactionRequestSchema.safeParse({
      reaction: text,
      source: sourceRef.current,
      userNames: userNamesRef.current,
    });
    if (!pair.success) {
      updateJudgment(id, { state: "failed" });
      setError(
        "反応は1〜500文字、元の話は2000文字以内、ユーザーネームは各20文字・32件以内で入力してください。",
      );
      return;
    }
    const sealed = stream.current.seal(id, pair.data.reaction);
    seen.current.add(id);
    if (seen.current.size > 100)
      seen.current.delete(seen.current.values().next().value!);
    if (!sealed.remaining) {
      finish(id, text, sealed.parts, 0);
      return;
    }
    if (jobs.current.length + Number(busy.current) >= 8) {
      updateJudgment(id, { state: "failed" });
      setError("判定が混み合っています。少し待ってから話してください。");
      return;
    }
    updateJudgment(id, { state: "queued" });
    jobs.current.push({
      id,
      text: sealed.remaining,
      fullText: text,
      prefixSegments: sealed.parts,
      source: pair.data.source,
      userNames: pair.data.userNames,
    });
    setPending(jobs.current.length + Number(busy.current));
    void pump();
  }
  function emit(segments: ReactionSegment[]) {
    for (const segment of segments)
      window.dispatchEvent(
        new CustomEvent("classified-reaction", {
          detail: { level: segment.level },
        }),
      );
  }
  function finish(
    id: string,
    text: string,
    segments: ReactionSegment[],
    elapsedMs: number,
  ) {
    const level = segments[0]!.level;
    updateJudgment(id, { state: "done", level, segments });
    setResults((previous) =>
      [
        { id, text, level, elapsedMs, segments },
        ...previous.filter((item) => item.id !== id),
      ].slice(0, 6),
    );
    setPreviewParts([]);
  }
  submitRef.current = submit;
  async function pump() {
    if (busy.current || !active.current) return;
    const job = jobs.current.shift();
    if (!job) return;
    busy.current = true;
    updateJudgment(job.id, { state: "classifying" });
    const version = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    const timeout = setTimeout(() => requestController.abort(), 180_000);
    setPending(jobs.current.length + 1);
    setError("");
    try {
      const started = performance.now();
      const decision = await client.current.evaluate(
        { source: job.source, reaction: job.text, userNames: job.userNames },
        requestController.signal,
      );
      const fresh = decision.segments ?? [
        { text: job.text, level: decision.level },
      ];
      const segments = [...job.prefixSegments, ...fresh];
      const elapsedMs = performance.now() - started;
      if (!active.current || version !== generation.current) return;
      finish(job.id, job.fullText, segments, elapsedMs);
      emit(fresh);
    } catch (reason) {
      if (active.current && version === generation.current) {
        setError(
          reason instanceof Error && reason.message === "busy"
            ? "判定が混み合っています。未発射の部分は塗りません。"
            : "判定できませんでした。未発射の部分は塗りません。サーバー接続とモデルの準備を確認してください。",
        );
        setPhase("error");
        updateJudgment(job.id, { state: "failed" });
        for (const queued of jobs.current)
          updateJudgment(queued.id, { state: "cancelled" });
        jobs.current.length = 0;
      }
    } finally {
      clearTimeout(timeout);
      if (version === generation.current) {
        busy.current = false;
        controller.current = null;
        setPending(jobs.current.length);
        void pump();
      }
    }
  }
  function preview(text: string, id: string) {
    if (!active.current) return;
    const pair = reactionRequestSchema.safeParse({
      reaction: text,
      source: sourceRef.current,
      userNames: userNamesRef.current,
    });
    if (!pair.success) return;
    const revision = stream.current.preview(id);
    if (revision === null) return;
    const version = generation.current;
    client.current.prefetch(pair.data, {
      delayMs: immediateAizuchiText(text) ? 0 : 80,
      onResult: (decision) => {
        if (!active.current || version !== generation.current) return;
        const fresh = stream.current.commit(id, revision, text, decision);
        if (!fresh.length) return;
        emit(fresh);
        setPreviewParts(stream.current.emitted(id));
      },
    });
  }
  async function prepare() {
    setError("");
    setPhase("loading");
    const version = generation.current;
    try {
      const response = await fetch(`${API}/prepare`, { method: "POST" });
      if (!response.ok) throw new Error();
    } catch {
      if (active.current && version === generation.current) {
        setPhase("error");
        setError("判定サーバーに接続できません。");
      }
    }
  }
  useEffect(() => {
    if (!enabled) return;
    active.current = true;
    const abort = () => {
      active.current = false;
      generation.current++;
      setJudgments((previous) =>
        Object.fromEntries(
          Object.entries(previous).map(([id, value]) => [
            id,
            value.state === "queued" || value.state === "classifying"
              ? { state: "cancelled" }
              : value,
          ]),
        ),
      );
      stream.current.clear();
      setPreviewParts([]);
      client.current.clear();
      controller.current?.abort();
      controller.current = null;
      jobs.current.length = 0;
      busy.current = false;
      setPending(0);
      window.dispatchEvent(new Event("reset-reaction-input"));
    };
    const transcript = (event: Event) => {
      const item = (event as CustomEvent<Transcript>).detail;
      if (
        item?.source === "microphone" &&
        typeof item.text === "string" &&
        typeof item.id === "string"
      )
        submitRef.current(item.text, item.id);
    };
    const interim = (event: Event) => {
      const { text, id } =
        (event as CustomEvent<{ text?: unknown; id?: unknown }>).detail ?? {};
      if (typeof text !== "string" || !text.trim()) {
        client.current.prefetch(null);
        return;
      }
      const pair = reactionRequestSchema.safeParse({
        reaction: text,
        source: sourceRef.current,
        userNames: userNamesRef.current,
      });
      if (!pair.success) return;
      if (typeof id !== "string") {
        client.current.prefetch(pair.data);
        return;
      }
      preview(pair.data.reaction, id);
    };
    window.addEventListener("interim-transcript", interim);
    const statusController = new AbortController();
    let polling = false;
    const status = async () => {
      if (polling || !active.current) return;
      polling = true;
      try {
        const response = await fetch(`${API}/status`, {
          signal: statusController.signal,
        });
        if (!response.ok) return;
        const data: { state?: unknown } = await response.json();
        if (
          active.current &&
          ["idle", "loading", "ready", "error"].includes(String(data.state))
        )
          setPhase(data.state as Phase);
      } catch {
        /* The first evaluation reports connection errors to the user. */
      } finally {
        polling = false;
      }
    };
    void status();
    const interval = setInterval(() => void status(), 1500);
    window.addEventListener("local-transcript", transcript);
    window.addEventListener("pagehide", abort);
    return () => {
      abort();
      statusController.abort();
      clearInterval(interval);
      window.removeEventListener("interim-transcript", interim);
      window.removeEventListener("local-transcript", transcript);
      window.removeEventListener("pagehide", abort);
    };
  }, [enabled]);
  return {
    phase,
    source,
    additionalUserNames,
    changeAdditionalUserNames: setAdditionalUserNames,
    registeredUserNames,
    pending,
    error,
    results,
    judgments,
    previewParts,
    preview,
    clearHistory: () => {
      setResults([]);
      setJudgments({});
      setPreviewParts([]);
    },
    prepare,
    submit,
    changeSource: (text: string) => {
      sourceRef.current = text;
      setSource(text);
    },
  };
}
