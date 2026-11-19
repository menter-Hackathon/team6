/** Compensate for the speaker being unable to paint during their turn. */
export function speakerTeamAreaMultiplier(teamSize: number): number {
  return teamSize <= 1 ? 1 : teamSize / (teamSize - 1);
}
