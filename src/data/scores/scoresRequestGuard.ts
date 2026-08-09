import type { EspnNormalizedGame } from '@/types';

/** Fetch scope that must match for empty-refresh preservation. */
export type ScoresFetchContext = {
  weekId: string;
  leagueFilter: string;
};

export type ScoresVisibleUpdate =
  | { type: 'apply'; games: EspnNormalizedGame[] }
  | { type: 'preserve'; reason: 'empty_refresh' }
  | { type: 'ignore'; reason: 'stale' };

/** Monotonic token so only the latest Scores request may update visible state. */
export function createScoresRequestGeneration(): {
  bump: () => number;
  current: () => number;
  isCurrent: (token: number) => boolean;
} {
  let generation = 0;
  return {
    bump: () => {
      generation += 1;
      return generation;
    },
    current: () => generation,
    isCurrent: (token: number) => token === generation,
  };
}

export function scoresFetchContextEquals(
  a: ScoresFetchContext | null | undefined,
  b: ScoresFetchContext | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.weekId === b.weekId && a.leagueFilter === b.leagueFilter;
}

/**
 * Decide how a completed Scores fetch should affect visible React state.
 *
 * Empty ESPN success preserves a known-good board only when the previous games
 * belong to the same week + league scope (refresh blip). A new week/filter that
 * legitimately returns [] still applies empty.
 */
export function resolveScoresVisibleUpdate(input: {
  isCurrent: boolean;
  fetchedGames: EspnNormalizedGame[];
  previousGames: EspnNormalizedGame[];
  previousContext: ScoresFetchContext | null;
  requestContext: ScoresFetchContext;
}): ScoresVisibleUpdate {
  if (!input.isCurrent) {
    return { type: 'ignore', reason: 'stale' };
  }

  if (input.fetchedGames.length > 0) {
    return { type: 'apply', games: input.fetchedGames };
  }

  if (
    input.previousGames.length > 0 &&
    scoresFetchContextEquals(input.previousContext, input.requestContext)
  ) {
    return { type: 'preserve', reason: 'empty_refresh' };
  }

  return { type: 'apply', games: input.fetchedGames };
}
