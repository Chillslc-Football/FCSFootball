import { fetchEspnJson } from '@/data/providers/espnFetch';
import {
  extractEspnScoreboardDate,
  parseEspnScoreboard,
  toRawRecord,
} from '@/data/providers/espnParser';
import type { EspnScoresProvider, ProviderResponse } from '@/data/providers/types';
import type { FetchWithTimeoutOptions } from '@/data/providers/espnFetch';
import type { EspnTodayGamesPayload } from '@/types';

/** FCS/I-AA scoreboard — scores, schedule, status, broadcast, IDs (not rankings). */
export const ESPN_FCS_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=81';

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
    options?: FetchWithTimeoutOptions,
  ): Promise<ProviderResponse<EspnTodayGamesPayload>> {
    const start = Date.now();

    const raw = await fetchEspnJson<unknown>(ESPN_FCS_SCOREBOARD_URL, options);

    if (!isRecord(raw)) {
      throw new Error('ESPN returned invalid data: expected a JSON object.');
    }

    const games = parseEspnScoreboard(raw);
    const date =
      extractEspnScoreboardDate(raw) ?? new Date().toISOString().slice(0, 10);

    const payload: EspnTodayGamesPayload = {
      date,
      games,
      raw: toRawRecord(raw),
      endpoint: ESPN_FCS_SCOREBOARD_URL,
    };

    return {
      providerId: this.id,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      data: payload,
    };
  }
}

export const espnScoresProvider = new EspnScoresProviderImpl();

/** @deprecated Use espnScoresProvider */
export const espnProvider = espnScoresProvider;

/** @deprecated Use EspnScoresProviderImpl */
export const EspnProvider = EspnScoresProviderImpl;
