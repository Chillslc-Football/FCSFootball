import type { EspnNormalizedGame, ScheduleGame } from '@/types';

export type SortableGameListing = {
  startTime: string;
  awayTeam: string;
  homeTeam: string;
  awayRank?: number;
  homeRank?: number;
};

function getStartTimeSortKey(startTime: string): number {
  if (!startTime || startTime === 'TBD') return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(startTime);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

/** Best (lowest) Top 25 rank in the game, or null when neither team is ranked. */
function getBestRank(game: SortableGameListing): number | null {
  const ranks = [game.awayRank, game.homeRank].filter(
    (rank): rank is number => rank != null && rank > 0,
  );
  if (ranks.length === 0) return null;
  return Math.min(...ranks);
}

/**
 * Compare games for display order:
 * 1. Earliest start time
 * 2. Better Top 25 rank (lower number = higher ranked)
 * 3. Ranked games before unranked at the same kickoff
 * 4. Away team name, then home team name
 */
export function compareSortableGames(a: SortableGameListing, b: SortableGameListing): number {
  const timeDiff = getStartTimeSortKey(a.startTime) - getStartTimeSortKey(b.startTime);
  if (timeDiff !== 0) return timeDiff;

  const aRank = getBestRank(a);
  const bRank = getBestRank(b);
  const aRanked = aRank != null;
  const bRanked = bRank != null;

  if (aRanked !== bRanked) return aRanked ? -1 : 1;
  if (aRanked && bRanked && aRank !== bRank) return aRank - bRank;

  const awayCmp = a.awayTeam.localeCompare(b.awayTeam, undefined, { sensitivity: 'base' });
  if (awayCmp !== 0) return awayCmp;

  return a.homeTeam.localeCompare(b.homeTeam, undefined, { sensitivity: 'base' });
}

function toSortableFromEspnGame(game: EspnNormalizedGame): SortableGameListing {
  return {
    startTime: game.startTime,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    awayRank: game.awayRank,
    homeRank: game.homeRank,
  };
}

function toSortableFromScheduleGame(game: ScheduleGame): SortableGameListing {
  return {
    startTime: game.startTime ?? game.time,
    awayTeam: game.awayTeam.fullName ?? game.awayTeam.name,
    homeTeam: game.homeTeam.fullName ?? game.homeTeam.name,
    awayRank: game.awayTeam.rank,
    homeRank: game.homeTeam.rank,
  };
}

/** Returns a new sorted array — does not mutate the input. */
export function sortEspnNormalizedGames(
  games: readonly EspnNormalizedGame[],
): EspnNormalizedGame[] {
  return [...games].sort((a, b) =>
    compareSortableGames(toSortableFromEspnGame(a), toSortableFromEspnGame(b)),
  );
}

/** Returns a new sorted array — does not mutate the input. */
export function sortScheduleGames(games: readonly ScheduleGame[]): ScheduleGame[] {
  return [...games].sort((a, b) =>
    compareSortableGames(toSortableFromScheduleGame(a), toSortableFromScheduleGame(b)),
  );
}
