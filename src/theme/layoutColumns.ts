/**
 * Shared protected-column geometry for dense list rows.
 * Keep header and data rows on the same constants to avoid drift.
 */
export const LAYOUT_COLUMNS = {
  /** Polls rank 1–25 (two digits) — must stay single-line. */
  pollRank: 36,
  /** Polls trailing points / movement cluster. */
  pollTrailingMin: 56,
  /** Conference standings CONF record column. */
  standingsConf: 52,
  /** Conference standings OVERALL header + record (wider than CONF). */
  standingsOverall: 68,
  /** Compact score / right meta on score-like rows. */
  scoreValue: 40,
  /** Compact kickoff date/time meta on team schedule rows. */
  scheduleMeta: 96,
} as const;

/** Alias used by Polls / Top25TeamCard. */
export const POLL_RANK_COLUMN_WIDTH = LAYOUT_COLUMNS.pollRank;

/** Alias used by Conference standings header + rows. */
export const STANDINGS_COLUMN_WIDTHS = {
  conf: LAYOUT_COLUMNS.standingsConf,
  overall: LAYOUT_COLUMNS.standingsOverall,
} as const;

export type LayoutColumns = typeof LAYOUT_COLUMNS;
