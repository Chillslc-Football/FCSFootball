/** Persisted favorite team entry — enough to render list rows and navigate. */
export type FavoriteTeam = {
  /** Route key (ESPN numeric id or slugified name). */
  key: string;
  espnTeamId?: string;
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  conference?: string;
  rank?: number;
  record?: string;
  savedAt: string;
};
