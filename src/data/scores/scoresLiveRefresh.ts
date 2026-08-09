import { shouldPollEspnNormalizedStatus } from '@/data/providers/espnGameStatus';
import type { EspnNormalizedGame } from '@/types';

/** ESPN live scoreboard refresh interval while visible games are in progress. */
export const SCORES_LIVE_REFRESH_INTERVAL_MS = 30_000;

/** Live / delayed / suspended — continue foreground polling. */
export function isLiveEspnNormalizedGame(game: EspnNormalizedGame): boolean {
  return shouldPollEspnNormalizedStatus(game.normalizedStatus);
}

export function hasLiveEspnNormalizedGames(games: EspnNormalizedGame[]): boolean {
  return games.some(isLiveEspnNormalizedGame);
}

export function countLiveEspnNormalizedGames(games: EspnNormalizedGame[]): number {
  return games.filter(isLiveEspnNormalizedGame).length;
}

/** True only while focused, foregrounded, enabled, and a visible game is in progress. */
export function shouldRunScoresLiveInterval(options: {
  enabled: boolean;
  appIsActive: boolean;
  isScreenFocused: boolean;
  hasVisibleLiveGames: boolean;
}): boolean {
  return (
    options.enabled &&
    options.appIsActive &&
    options.isScreenFocused &&
    options.hasVisibleLiveGames
  );
}
