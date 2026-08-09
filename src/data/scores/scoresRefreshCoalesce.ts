/**
 * Skip a Scores focus catch-up when the same week/league context just loaded.
 * Prevents scores-week-or-filter + scores-focus double force-refresh on entry.
 */
export function shouldSkipScoresFocusRefresh(options: {
  trigger: string;
  contextKey: string;
  lastLoadKey: string | null;
  lastLoadAtMs: number;
  nowMs?: number;
  coalesceWindowMs?: number;
}): boolean {
  if (!options.trigger.endsWith('-focus')) return false;

  const windowMs = options.coalesceWindowMs ?? 3_000;
  const now = options.nowMs ?? Date.now();
  if (!options.lastLoadKey) return false;
  if (options.lastLoadKey !== options.contextKey) return false;
  return now - options.lastLoadAtMs < windowMs;
}

export function buildScoresLoadContextKey(weekId: string, leagueFilter: string): string {
  return `${weekId}|${leagueFilter}`;
}
