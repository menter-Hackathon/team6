import { describe, expect, it, vi } from "vitest";
import { commitEpisodeDraft, EMPTY_EPISODE_DRAFT } from "./episode-input";

describe("commitEpisodeDraft", () => {
  it("sends the trimmed text once and marks it saved", () => {
    const onSave = vi.fn();
    const next = commitEpisodeDraft({ text: "  ラーメンの話 ", savedText: null }, onSave);
    expect(onSave).toHaveBeenCalledWith("ラーメンの話");
    expect(next).toEqual({ text: "  ラーメンの話 ", savedText: "ラーメンの話" });
  });

  it("does nothing when the text is already saved or still empty", () => {
    const onSave = vi.fn();
    const saved = { text: "話", savedText: "話" };
    expect(commitEpisodeDraft(saved, onSave)).toBe(saved);
    expect(commitEpisodeDraft(EMPTY_EPISODE_DRAFT, onSave)).toBe(EMPTY_EPISODE_DRAFT);
    expect(onSave).not.toHaveBeenCalled();
  });
});
