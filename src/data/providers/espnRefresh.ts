import { clearEspnCache } from '@/data/providers/espnCache';
import { resetSeasonGamesLoad } from '@/data/teams/loadTeamSeasonGames';
import { clearTeamGamesCache } from '@/data/teams/teamGamesStore';

/**
 * Bypass ESPN in-memory caches and reload season game aggregation on next access.
 * Pass `{ forceRefresh: true }` to `espnScoresProvider.getWeekGames()` / `getTodayGames()`
 * for a single-request refresh without clearing unrelated entries.
 */
export function forceRefreshEspnData(): void {
  clearEspnCache();
  resetSeasonGamesLoad();
  clearTeamGamesCache();
}
