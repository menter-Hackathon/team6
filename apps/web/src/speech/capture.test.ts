import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MicrophoneCapture } from "./capture";
let contexts: FakeContext[];
let worklets: FakeWorklet[];
class FakeContext {
  state = "running";
  sampleRate = 48000;
  destination = {};
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {
    this.state = "closed";
  });
  audioWorklet = { addModule: vi.fn(async () => {}) };
  createGain = () => ({ gain: { value: 1 }, connect: vi.fn() });
  createMediaStreamSource = () => ({ connect: vi.fn() });
  constructor() {
    contexts.push(this);
  }
}
class FakeWorklet {
  port: { onmessage: ((event: { data: Float32Array }) => void) | null } = {
    onmessage: null,
  };
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() {
    worklets.push(this);
  }
}
beforeEach(() => {
  contexts = [];
  worklets = [];
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("AudioWorkletNode", FakeWorklet);
});
afterEach(() => vi.unstubAllGlobals());
it("starts microphone activity and releases the track, worklet and audio context on OFF", async () => {
  const track = { stop: vi.fn() };
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const capture = new MicrophoneCapture(),
    activity = vi.fn();
  await capture.start(vi.fn(), activity);
  const callback = worklets[0]!.port.onmessage!;
  callback({ data: new Float32Array(2048).fill(0.04) });
  expect(activity).toHaveBeenCalledTimes(1);
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  capture.stop(false);
  callback({ data: new Float32Array(2048).fill(0.04) });
  expect(activity).toHaveBeenCalledTimes(1);
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(worklets[0]!.disconnect).toHaveBeenCalledTimes(1);
  expect(worklets[0]!.port.onmessage).toBeNull();
  expect(contexts[0]!.close).toHaveBeenCalledTimes(1);
});
it("releases a late microphone permission result after the user cancels ON", async () => {
  const track = { stop: vi.fn() };
  let allow!: (stream: { getTracks: () => (typeof track)[] }) => void;
  const request = new Promise<{ getTracks: () => (typeof track)[] }>(
    (resolve) => {
      allow = resolve;
    },
  );
  const getUserMedia = vi.fn(() => request);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const capture = new MicrophoneCapture();
  const pending = capture.start(vi.fn(), vi.fn());
  await Promise.resolve();
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  capture.stop(false);
  allow({ getTracks: () => [track] });
  await pending;
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(contexts[0]!.close).toHaveBeenCalledTimes(1);
  expect(worklets).toHaveLength(0);
});

it("passes live microphone snapshots before delivering the final utterance on OFF", async () => {
  const track = { stop: vi.fn() };
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) },
  });
  const capture = new MicrophoneCapture(),
    final = vi.fn(),
    preview = vi.fn();
  await capture.start(final, vi.fn(), preview);
  for (let i = 0; i < 25; i++)
    worklets[0]!.port.onmessage!({ data: new Float32Array(2048).fill(0.04) });
  expect(preview).toHaveBeenCalled();
  expect(final).not.toHaveBeenCalled();
  capture.stop();
  expect(final).toHaveBeenCalledTimes(1);
  expect(preview.mock.calls[0]![1]).toBe(final.mock.calls[0]![1]);
  expect(track.stop).toHaveBeenCalledTimes(1);
});

it("uses the selected microphone with automatic gain control", async () => {
  const getUserMedia = vi.fn(async () => ({
    getTracks: () => [{ stop: vi.fn() }],
  }));
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const capture = new MicrophoneCapture();
  await capture.start(vi.fn(), vi.fn(), vi.fn(), "headset-input");
  expect(getUserMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({
        deviceId: { exact: "headset-input" },
        autoGainControl: true,
      }),
    }),
  );
  capture.stop(false);
});
