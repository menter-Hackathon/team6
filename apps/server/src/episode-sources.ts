/**
 * Where the reaction API finds the current speaker's entered story (D-090).
 * Rooms register getters for the active turn and its shared topic.
 */
const sources = new Map<
  string,
  { story: () => string; turn?: () => number | undefined }
>();

export function registerEpisodeSource(
  roomId: string,
  story: () => string,
  turn?: () => number | undefined,
): void {
  sources.set(roomId, { story, ...(turn ? { turn } : {}) });
}

export function unregisterEpisodeSource(roomId: string): void {
  sources.delete(roomId);
}

/** The story of whoever is speaking now in that room, or "" when there is none. */
export function currentEpisode(roomId: string | undefined): string {
  if (!roomId) return "";
  return sources.get(roomId)?.story() ?? "";
}

export function currentReactionTurn(
  roomId: string | undefined,
): number | undefined {
  return roomId ? sources.get(roomId)?.turn?.() : undefined;
}
