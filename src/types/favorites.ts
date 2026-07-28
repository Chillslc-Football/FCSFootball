/** Persisted favorite team entry — enough to render list rows and navigate. */
export type FavoriteTeam = {
  /** Route key (ESPN numeric id or slugified name). */
  key: string;
  espnTeamId?: string;
  name: string;
  /**
   * ESPN shortDisplayName when resolved from loaded games (display only).
   * Not required for persistence; Scores-style labels prefer this over `name`.
   */
  shortDisplayName?: string;
  abbreviation?: string;
  logoUrl?: string;
  conference?: string;
  rank?: number;
  record?: string;
  savedAt: string;
};
