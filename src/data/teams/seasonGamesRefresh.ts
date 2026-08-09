import { espnScoresProvider } from '@/data/providers/espnProvider';
import {
  resolveCurrentScoresWeekId,
} from '@/data/providers/espnScheduleWeek';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import {
  getAllCachedEspnGames,
  registerEspnGames,
} from '@/data/teams/teamGamesStore';
import type { EspnNormalizedGame, ScheduleWeekId } from '@/types';

export type SeasonRefreshMode = 'season' | 'current-week';

/**
 * Decide whether Home/Team should reload the full season or only the current week.
 * Live ticks never force weeks 1–17. Focus/app-active reuse the season cache when present.
 */
export function resolveSeasonRefreshMode(options: {
  pullRefresh?: boolean;
  currentWeekOnly?: boolean;
  trigger?: string;
  hasSeasonCache: boolean;
}): SeasonRefreshMode {
  if (options.pullRefresh) return 'season';
  if (options.currentWeekOnly) return 'current-week';
  if (options.trigger?.endsWith('-live-poll')) return 'current-week';
  if (options.hasSeasonCache && (options.trigger?.endsWith('-focus') || options.trigger?.endsWith('-app-active'))) {
    return 'current-week';
  }
  return 'season';
}

/** Merge week games into a season list by ESPN game id (newer week payload wins). */
export function mergeWeekGamesIntoSeason(
  existing: EspnNormalizedGame[],
  weekGames: EspnNormalizedGame[],
): EspnNormalizedGame[] {
  const byId = new Map<string, EspnNormalizedGame>();
  for (const game of existing) {
    byId.set(game.id, game);
  }
  for (const game of weekGames) {
    byId.set(game.id, game);
  }
  return [...byId.values()];
}

/**
 * Force-refresh the current FCS week and merge into the in-memory season store by game id.
 * Other weeks remain intact. Does not call ensureSeasonGamesLoaded.
 */
export async function refreshCurrentWeekGamesIntoSeason(options?: {
  forceRefresh?: boolean;
  weekId?: ScheduleWeekId;
}): Promise<{
  weekId: ScheduleWeekId;
  weekGames: EspnNormalizedGame[];
  allGames: EspnNormalizedGame[];
}> {
  const weekId = options?.weekId ?? resolveCurrentScoresWeekId();
  const response = await espnScoresProvider.getWeekGames(weekId, {
    forceRefresh: options?.forceRefresh ?? true,
  });

  const ranked = await mergeStaticRankingsOntoGames(response.data.games);
  registerEspnGames(ranked.games);

  return {
    weekId,
    weekGames: ranked.games,
    allGames: getAllCachedEspnGames(),
  };
}
