/**
 * Pure helpers for resilient team season week loading.
 * Keeps retry / partial-state logic out of the ESPN provider (no global retry blast).
 */

import type { EspnNormalizedGame, ScheduleWeekId } from '@/types';
import { getTeamSideInGame } from '@/utils/teamId';

export const SEASON_WEEK_RETRY_DELAY_MS = 400;
/** Initial attempt + one retry. */
export const SEASON_WEEK_MAX_ATTEMPTS = 2;

export type SeasonWeekFetchResult = {
  weekId: ScheduleWeekId;
  games: EspnNormalizedGame[] | null;
  attempts: number;
  failed: boolean;
};

export function shouldRetryFailedSeasonWeeks(trigger?: string): boolean {
  if (!trigger) return true;
  // Live score ticks must stay current-week-only (performance hardening).
  return !trigger.endsWith('-live-poll');
}

export async function fetchSeasonWeekWithRetry(options: {
  weekId: ScheduleWeekId;
  fetchWeek: (weekId: ScheduleWeekId) => Promise<EspnNormalizedGame[]>;
  maxAttempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<SeasonWeekFetchResult> {
  const maxAttempts = options.maxAttempts ?? SEASON_WEEK_MAX_ATTEMPTS;
  const delayMs = options.delayMs ?? SEASON_WEEK_RETRY_DELAY_MS;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let attempts = 0;
  let lastError: unknown;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const games = await options.fetchWeek(options.weekId);
      return { weekId: options.weekId, games, attempts, failed: false };
    } catch (error) {
      lastError = error;
      if (attempts < maxAttempts) {
        await sleep(delayMs);
      }
    }
  }

  console.warn(
    `[seasonWeekLoad] week ${options.weekId} failed after ${attempts} attempt(s):`,
    lastError,
  );
  return { weekId: options.weekId, games: null, attempts, failed: true };
}

/** Merge successful week payloads by game id (first-seen wins for collection order). */
export function collectGamesFromWeekResults(
  results: SeasonWeekFetchResult[],
  existing: EspnNormalizedGame[] = [],
): {
  games: EspnNormalizedGame[];
  failedWeekIds: ScheduleWeekId[];
  isPartial: boolean;
} {
  const seen = new Set(existing.map((game) => game.id));
  const collected: EspnNormalizedGame[] = [...existing];
  const failedWeekIds: ScheduleWeekId[] = [];

  for (const result of results) {
    if (result.failed || !result.games) {
      failedWeekIds.push(result.weekId);
      continue;
    }
    for (const game of result.games) {
      if (seen.has(game.id)) continue;
      seen.add(game.id);
      collected.push(game);
    }
  }

  return {
    games: collected,
    failedWeekIds,
    isPartial: failedWeekIds.length > 0,
  };
}

/**
 * Prefer the most recent game that carries an ESPN overall record string
 * (same idea as enrichFavoriteTeam — avoids Week 1 snapshot staleness).
 */
export function pickTeamProfileSourceGame(
  games: EspnNormalizedGame[],
  teamKey: string,
): EspnNormalizedGame | null {
  if (games.length === 0) return null;

  for (let index = games.length - 1; index >= 0; index -= 1) {
    const game = games[index];
    const side = getTeamSideInGame(game, teamKey);
    if (!side) continue;
    const record = (side === 'away' ? game.awayRecord : game.homeRecord)?.trim();
    if (record) return game;
  }

  for (let index = games.length - 1; index >= 0; index -= 1) {
    const game = games[index];
    if (getTeamSideInGame(game, teamKey)) return game;
  }

  return null;
}
