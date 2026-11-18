import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  BrowserRecognition,
  recognitionConstructor,
  type BrowserRecognizer,
  type BrowserResultEvent,
} from "./browser-recognition";
let instances: FakeRecognition[];
class FakeRecognition implements BrowserRecognizer {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: BrowserRecognizer["onstart"] = null;
  onend: BrowserRecognizer["onend"] = null;
  onerror: BrowserRecognizer["onerror"] = null;
  onresult: BrowserRecognizer["onresult"] = null;
  onspeechstart: BrowserRecognizer["onspeechstart"] = null;
  onspeechend: BrowserRecognizer["onspeechend"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    instances.push(this);
  }
}
function setup() {
  const callbacks = {
    state: vi.fn(),
    speaking: vi.fn(),
    partial: vi.fn(),
    interim: vi.fn(),
    final: vi.fn(),
    error: vi.fn(),
  };
  return {
    recognition: new BrowserRecognition(FakeRecognition, callbacks),
    callbacks,
  };
}
function results(
  resultIndex: number,
  ...items: [string, boolean][]
): BrowserResultEvent {
  return {
    resultIndex,
    results: items.map(([transcript, isFinal]) => ({
      0: { transcript },
      isFinal,
    })),
  };
}
beforeEach(() => {
  instances = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("supports standard and prefixed implementations without starting a microphone", () => {
  vi.stubGlobal("window", {});
  expect(recognitionConstructor()).toBeUndefined();
  vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
  expect(recognitionConstructor()).toBe(FakeRecognition);
  vi.stubGlobal("window", { SpeechRecognition: FakeRecognition });
  expect(recognitionConstructor()).toBe(FakeRecognition);
  setup();
  expect(instances).toHaveLength(0);
});
it("streams Japanese interim revisions and emits each final index only once", () => {
  const { recognition, callbacks } = setup();
  recognition.start();
  recognition.start();
  expect(instances).toHaveLength(1);
  const instance = instances[0]!;
  expect(instance).toMatchObject({
    lang: "ja-JP",
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
  });
  instance.onstart!();
  expect(callbacks.state).toHaveBeenLastCalledWith("listening");
  instance.onresult!(results(0, ["こんに", false]));
  instance.onresult!(results(0, ["こんにちは", false]));
  expect(callbacks.partial).toHaveBeenLastCalledWith("こんにちは");
  expect(callbacks.final).not.toHaveBeenCalled();
  instance.onresult!(results(0, ["こんにちは", true], ["今日", false]));
  instance.onresult!(results(1, ["こんにちは", true], ["今日は晴れ", false]));
  instance.onresult!(results(0, ["こんにちは", true], ["今日は晴れ", true]));
  expect(callbacks.final.mock.calls.map(([text]) => text)).toEqual([
    "こんにちは",
    "今日は晴れ",
  ]);
  expect(callbacks.partial).toHaveBeenLastCalledWith("");
  recognition.cancel();
});
it("allows one final response on OFF and never restarts after the end", () => {
  const { recognition, callbacks } = setup();
  recognition.start();
  const instance = instances[0]!;
  instance.onstart!();
  recognition.stop();
  expect(instance.stop).toHaveBeenCalledOnce();
  expect(callbacks.state).toHaveBeenLastCalledWith("stopping");
  instance.onresult!(results(0, ["止めます", true]));
  instance.onend!();
  vi.runAllTimers();
  expect(callbacks.final).toHaveBeenCalledOnce();
  expect(callbacks.final.mock.calls[0]![0]).toBe("止めます");
  expect(callbacks.state).toHaveBeenLastCalledWith("off");
  expect(instances).toHaveLength(1);
});
it("aborts on close, ignores late events and releases a pending permission request", () => {
  const { recognition, callbacks } = setup();
  recognition.start();
  const instance = instances[0]!,
    lateStart = instance.onstart!,
    lateResult = instance.onresult!,
    lateEnd = instance.onend!;
  recognition.cancel();
  lateStart();
  lateResult(results(0, ["遅れて到着", true]));
  lateEnd();
  vi.runAllTimers();
  expect(instance.abort).toHaveBeenCalledOnce();
  expect(callbacks.final).not.toHaveBeenCalled();
  expect(callbacks.state).toHaveBeenLastCalledWith("off");
  expect(instance.onresult).toBeNull();
  expect(instances).toHaveLength(1);
});
it("reports permission and service failures without retrying or falling back", () => {
  for (const error of [
    "not-allowed",
    "service-not-allowed",
    "network",
    "audio-capture",
  ]) {
    const { recognition, callbacks } = setup();
    recognition.start();
    const instance = instances.at(-1)!;
    instance.onerror!({ error });
    expect(instance.abort).toHaveBeenCalledOnce();
    expect(callbacks.error.mock.lastCall?.[0]).toBeTruthy();
    expect(callbacks.state).toHaveBeenLastCalledWith("off");
  }
  vi.runAllTimers();
  expect(instances).toHaveLength(4);
});
it("restarts an automatic service end while ON, but cancels a scheduled restart on OFF", () => {
  const { recognition } = setup();
  recognition.start();
  instances[0]!.onend!();
  vi.advanceTimersByTime(500);
  expect(instances).toHaveLength(2);
  instances[1]!.onend!();
  recognition.stop();
  vi.runAllTimers();
  expect(instances).toHaveLength(2);
});
it("limits rapid service endings and releases a service that never acknowledges OFF", () => {
  const { recognition, callbacks } = setup();
  recognition.start();
  for (let i = 0; i < 3; i++) {
    instances[i]!.onend!();
    vi.advanceTimersByTime(500);
  }
  expect(instances).toHaveLength(3);
  expect(callbacks.state).toHaveBeenLastCalledWith("off");
  expect(callbacks.error.mock.lastCall?.[0]).toContain("繰り返し");
  recognition.start();
  recognition.stop();
  vi.advanceTimersByTime(2000);
  expect(instances[3]!.abort).toHaveBeenCalledOnce();
  expect(callbacks.state).toHaveBeenLastCalledWith("off");
});
it("recovers from a synchronous start failure", () => {
  class Broken extends FakeRecognition {
    override start = vi.fn(() => {
      throw new Error("unavailable");
    });
  }
  const { callbacks } = setup();
  const recognition = new BrowserRecognition(Broken, callbacks);
  recognition.start();
  expect(instances[0]!.abort).toHaveBeenCalledOnce();
  expect(callbacks.error.mock.lastCall?.[0]).toContain("開始できません");
  expect(callbacks.state).toHaveBeenLastCalledWith("off");
});

it("keeps one utterance ID across interim revisions and finalization", () => {
  const { recognition, callbacks } = setup();
  recognition.start();
  const instance = instances[0]!;
  instance.onresult!(results(0, ["はい", false]));
  const id = callbacks.interim.mock.calls[0]![1];
  instance.onresult!(results(0, ["はいはい", false]));
  expect(callbacks.interim).toHaveBeenLastCalledWith("はいはい", id);
  instance.onresult!(results(0, ["はいはい", true]));
  expect(callbacks.final).toHaveBeenCalledWith("はいはい", id);
  instance.onresult!(results(1, ["はいはい", true], ["なるほど", false]));
  expect(callbacks.interim.mock.lastCall![1]).not.toBe(id);
  recognition.cancel();
});
