/**
 * Where the reaction API finds the current speaker's entered story (D-090).
 * Rooms register a getter; the story text stays on the server and is never broadcast.
 */
const sources = new Map<string, () => string>();

export function registerEpisodeSource(
  roomId: string,
  current: () => string,
): void {
  sources.set(roomId, current);
}

export function unregisterEpisodeSource(roomId: string): void {
  sources.delete(roomId);
}

/** The story of whoever is speaking now in that room, or "" when there is none. */
export function currentEpisode(roomId: string | undefined): string {
  if (!roomId) return "";
  return sources.get(roomId)?.() ?? "";
}
