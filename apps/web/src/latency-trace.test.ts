import { afterEach, describe, expect, it, vi } from "vitest";
import {
  finishTrace,
  forkTrace,
  latencySummary,
  recordInkRoundTrip,
  recordUnconfirmedShot,
  traceStage,
} from "./latency-trace";
import {
  clearVoiced,
  lastVoiceOnset,
  reportMicRms,
} from "./speech/voice-feedback";

describe("latency trace", () => {
  afterEach(() => {
    clearVoiced();
    vi.restoreAllMocks();
  });
  it("measures each fired reaction from the voice onset", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    reportMicRms(0.05, 1000);
    traceStage("utt", "interim", { text: "はいはい" }, 1300);
    const first = forkTrace("utt")!,
      second = forkTrace("utt")!;
    expect(first).not.toBe(second);
    traceStage(
      first,
      "classified",
      { level: "短い相槌", via: "interim" },
      1400,
    );
    traceStage(first, "sent", {}, 1420);
    traceStage(first, "echo", {}, 1510);
    finishTrace(first);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]![0]);
    expect(line).toContain("途中認識 +300ms");
    expect(line).toContain("判定 +400ms");
    expect(line).toContain("サーバー返信 +510ms");
    expect(line).toContain("確定 —");
    finishTrace(second);
    expect(latencySummary().medianMs.interim).toBe(300);
  });
  it("keeps the first stamp of a stage and ignores unknown keys", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    traceStage("dup", "final", {}, 2000);
    traceStage("dup", "final", {}, 2500);
    traceStage("dup", "sent", {}, 2600);
    finishTrace("dup");
    expect(() => finishTrace("missing")).not.toThrow();
    expect(() => traceStage(undefined, "sent")).not.toThrow();
  });
  it("summarizes ink round trips and rejected predictions", () => {
    recordInkRoundTrip(80);
    recordInkRoundTrip(120);
    recordInkRoundTrip(100);
    recordUnconfirmedShot();
    const summary = latencySummary();
    expect(summary.inkRoundTripMedianMs).toBe(100);
    expect(summary.unconfirmedPredictedShots).toBe(1);
  });
});

describe("voice onset", () => {
  afterEach(clearVoiced);
  it("starts a new onset only after a quiet gap", () => {
    reportMicRms(0.05, 1000);
    reportMicRms(0.05, 1200);
    expect(lastVoiceOnset()).toBe(1000);
    reportMicRms(0.05, 1600);
    expect(lastVoiceOnset()).toBe(1600);
    reportMicRms(0.001, 1700);
    expect(lastVoiceOnset()).toBe(1600);
  });
});
