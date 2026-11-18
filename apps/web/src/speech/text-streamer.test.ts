import { expect, it, vi } from "vitest";
import type { WhisperTokenizer } from "@huggingface/transformers";
import { speechTextStreamer } from "./text-streamer";
it("streams Japanese tokens without waiting for spaces or the end of generation", () => {
  const tokenizer = {
    timestamp_begin: 1000,
    decode: (tokens: bigint[]) =>
      tokens
        .map((t) => ({ 1: "こ", 2: "ん", 3: "にちは" })[Number(t)] ?? "")
        .join(""),
  } as unknown as WhisperTokenizer;
  const update = vi.fn(),
    streamer = speechTextStreamer(tokenizer, update);
  streamer.put([[0n]]);
  expect(update).not.toHaveBeenCalled();
  streamer.put([[1n]]);
  expect(update).toHaveBeenLastCalledWith("こ");
  streamer.put([[2n]]);
  expect(update).toHaveBeenLastCalledWith("こん");
  streamer.put([[3n]]);
  expect(update).toHaveBeenLastCalledWith("こんにちは");
});
