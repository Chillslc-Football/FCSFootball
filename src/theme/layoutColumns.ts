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
  /**
   * Home Quick Links (icon-free): trailing chevron only.
   * Matches today.tsx: paddingLeft sm, paddingRight xs, gap xs, border 1.
   */
  quickLinkChevron: 18,
  quickLinkGap: 4,
  quickLinkPaddingLeft: 8,
  quickLinkPaddingRight: 4,
  quickLinkBorderH: 2,
  quickLinkRowGap: 8,
  /** Matches Screen content `padding: spacing.lg` horizontal. */
  quickLinkScreenPaddingH: 24,
} as const;

/**
 * Conservative average glyph width for bold 16pt body on iOS (SF Pro).
 * Used only for geometry contracts — not runtime measurement.
 */
const QUICK_LINK_CHAR_WIDTH_ESTIMATE = 9.5;

/**
 * Text width available inside one Quick Link card for the label.
 * Chevron is non-shrinking; text is flexible. No leading icon.
 */
export function quickLinkLabelMaxWidth(cardOuterWidth: number): number {
  const chrome =
    LAYOUT_COLUMNS.quickLinkBorderH +
    LAYOUT_COLUMNS.quickLinkPaddingLeft +
    LAYOUT_COLUMNS.quickLinkPaddingRight +
    LAYOUT_COLUMNS.quickLinkGap +
    LAYOUT_COLUMNS.quickLinkChevron;
  return Math.max(0, cardOuterWidth - chrome);
}

/** Card outer width for one of two equal Quick Links in a horizontal row. */
export function quickLinkCardWidth(screenWidth: number): number {
  const content = screenWidth - LAYOUT_COLUMNS.quickLinkScreenPaddingH * 2;
  return (content - LAYOUT_COLUMNS.quickLinkRowGap) / 2;
}

/** Whether a Quick Link label fits without ellipsis at normal font scale. */
export function quickLinkLabelFitsAtWidth(label: string, screenWidth: number): boolean {
  const max = quickLinkLabelMaxWidth(quickLinkCardWidth(screenWidth));
  return label.length * QUICK_LINK_CHAR_WIDTH_ESTIMATE <= max;
}

/** Alias used by Polls / Top25TeamCard. */
export const POLL_RANK_COLUMN_WIDTH = LAYOUT_COLUMNS.pollRank;

/** Alias used by Conference standings header + data rows. */
export const STANDINGS_COLUMN_WIDTHS = {
  conf: LAYOUT_COLUMNS.standingsConf,
  overall: LAYOUT_COLUMNS.standingsOverall,
} as const;

export type LayoutColumns = typeof LAYOUT_COLUMNS;
