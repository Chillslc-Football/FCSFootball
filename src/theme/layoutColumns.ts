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
  /** Home Quick Links: fixed icon / chevron; text takes remaining width. */
  quickLinkIcon: 18,
  quickLinkChevron: 18,
  quickLinkGap: 4,
  quickLinkPaddingH: 8,
  quickLinkRowGap: 8,
  /** Matches Screen content `paddingHorizontal: spacing.lg`. */
  quickLinkScreenPaddingH: 24,
} as const;

/** Approximate average glyph width for bold body text at default font scale. */
const QUICK_LINK_CHAR_WIDTH_ESTIMATE = 8.2;

/**
 * Text width available inside one Quick Link card for the label.
 * icon + chevron are non-shrinking; text is flexible.
 */
export function quickLinkLabelMaxWidth(cardInnerWidth: number): number {
  const chrome =
    LAYOUT_COLUMNS.quickLinkIcon +
    LAYOUT_COLUMNS.quickLinkChevron +
    LAYOUT_COLUMNS.quickLinkGap * 2 +
    LAYOUT_COLUMNS.quickLinkPaddingH * 2;
  return Math.max(0, cardInnerWidth - chrome);
}

/** Card width for one of two equal Quick Links in a horizontal row. */
export function quickLinkCardWidth(screenWidth: number): number {
  const content =
    screenWidth -
    LAYOUT_COLUMNS.quickLinkScreenPaddingH * 2;
  return (content - LAYOUT_COLUMNS.quickLinkRowGap) / 2;
}

/** Whether a Quick Link label fits without ellipsis at normal font scale. */
export function quickLinkLabelFitsAtWidth(label: string, screenWidth: number): boolean {
  const max = quickLinkLabelMaxWidth(quickLinkCardWidth(screenWidth));
  return label.length * QUICK_LINK_CHAR_WIDTH_ESTIMATE <= max;
}

/** Alias used by Polls / Top25TeamCard. */
export const POLL_RANK_COLUMN_WIDTH = LAYOUT_COLUMNS.pollRank;

/** Alias used by Conference standings header + rows. */
export const STANDINGS_COLUMN_WIDTHS = {
  conf: LAYOUT_COLUMNS.standingsConf,
  overall: LAYOUT_COLUMNS.standingsOverall,
} as const;

export type LayoutColumns = typeof LAYOUT_COLUMNS;
