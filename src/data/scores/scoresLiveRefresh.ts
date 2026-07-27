import type { EspnNormalizedGame } from '@/types';

/** ESPN live scoreboard refresh interval while visible games are in progress. */
export const SCORES_LIVE_REFRESH_INTERVAL_MS = 60_000;

/** Uses ESPN parser mapping — live games have normalizedStatus in_progress. */
export function isLiveEspnNormalizedGame(game: EspnNormalizedGame): boolean {
  return game.normalizedStatus === 'in_progress';
}

export function hasLiveEspnNormalizedGames(games: EspnNormalizedGame[]): boolean {
  return games.some(isLiveEspnNormalizedGame);
}

export function countLiveEspnNormalizedGames(games: EspnNormalizedGame[]): number {
  return games.filter(isLiveEspnNormalizedGame).length;
}
