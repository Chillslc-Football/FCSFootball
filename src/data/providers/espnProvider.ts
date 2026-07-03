import { fetchEspnJson } from '@/data/providers/espnFetch';
import {
  extractEspnScoreboardDate,
  parseEspnScoreboardNormalized,
  toRawRecord,
} from '@/data/providers/espnParser';
import type { EspnScoresProvider, EspnFetchOptions, ProviderResponse } from '@/data/providers/types';
import type { FetchWithTimeoutOptions } from '@/data/providers/espnFetch';
import type { EspnTodayGamesPayload } from '@/types';

/** FCS/I-AA scoreboard — scores, schedule, status, broadcast, IDs (not rankings). */
export {
  ESPN_FCS_SCOREBOARD_URL,
  ESPN_SCOREBOARD_BASE,
  buildEspnWeekScoreboardUrl,
} from '@/data/providers/espnWeekQuery';
export type { EspnWeekPresetId } from '@/data/providers/espnWeekQuery';

import { ESPN_FCS_SCOREBOARD_URL } from '@/data/providers/espnWeekQuery';

/** Convert YYYY-MM-DD to ESPN dates= param (YYYYMMDD). */
export function formatEspnDateParam(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/** Local calendar date as YYYY-MM-DD. */
export function getLocalTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Build FCS scoreboard URL with optional date filter. */
export function buildEspnFcsScoreboardUrl(dateIso?: string): string {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return ESPN_FCS_SCOREBOARD_URL;
  }
  return `${ESPN_FCS_SCOREBOARD_URL}&dates=${formatEspnDateParam(dateIso)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * ESPN scores & schedule provider.
 * Does NOT supply FCS Top 25 — use ncaaRankingsProvider for rankings.
 */
export class EspnScoresProviderImpl implements EspnScoresProvider {
  readonly id = 'espn-scores' as const;
  readonly displayName = 'ESPN Scores & Schedule';

  async getTodayGames(
    options?: EspnFetchOptions,
  ): Promise<ProviderResponse<EspnTodayGamesPayload>> {
    const start = Date.now();
    const dateIso = options?.dateIso ?? getLocalTodayIsoDate();
    const endpoint = buildEspnFcsScoreboardUrl(dateIso);
    const fetchOptions: FetchWithTimeoutOptions = {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
    };

    try {
      const raw = await fetchEspnJson<unknown>(endpoint, fetchOptions);

      if (!isRecord(raw)) {
        throw new Error('ESPN returned invalid data: expected a JSON object.');
      }

      const parseResult = parseEspnScoreboardNormalized(raw);
      const games = parseResult.games;
      const date = extractEspnScoreboardDate(raw) ?? dateIso;

      const payload: EspnTodayGamesPayload = {
        date,
        games,
        raw: toRawRecord(raw),
        endpoint,
      };

      return {
        providerId: this.id,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        data: payload,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown ESPN fetch error';
      console.log('[ESPN Provider] getTodayGames failed', message);
      throw err;
    }
  }
}

export const espnScoresProvider = new EspnScoresProviderImpl();

/** @deprecated Use espnScoresProvider */
export const espnProvider = espnScoresProvider;

/** @deprecated Use EspnScoresProviderImpl */
export const EspnProvider = EspnScoresProviderImpl;
