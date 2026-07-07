import { fetchEspnJson } from '@/data/providers/espnFetch';
import {
  buildEspnEndpointCacheKey,
  buildEspnWeekCacheKey,
  getOrFetchEspnCached,
  resolveEspnCacheTtlMs,
  type EspnScoreboardCachePayload,
} from '@/data/providers/espnCache';
import {
  extractEspnScoreboardDate,
  parseEspnScoreboardNormalized,
  toRawRecord,
} from '@/data/providers/espnParser';
import { getScheduleWeekConfig, getScheduleWeekConfigForGroup, resolveEspnSourceWeekIds } from '@/data/providers/espnScheduleWeek';
import type { EspnScoresProvider, EspnFetchOptions, ProviderResponse, ScoresLeagueFilterId } from '@/data/providers/types';
import type { FetchWithTimeoutOptions } from '@/data/providers/espnFetch';
import type { EspnNormalizedGame, EspnTodayGamesPayload, EspnWeekGamesPayload, ScheduleWeekId } from '@/types';

/** FCS/I-AA scoreboard — scores, schedule, status, broadcast, IDs (not rankings). */
export {
  ESPN_FCS_SCOREBOARD_URL,
  ESPN_FBS_SCOREBOARD_URL,
  ESPN_SCOREBOARD_BASE,
  ESPN_SCOREBOARD_GROUP_FBS,
  ESPN_SCOREBOARD_GROUP_FCS,
  buildEspnWeekScoreboardUrl,
} from '@/data/providers/espnWeekQuery';
export type { EspnScoreboardGroupId, EspnWeekPresetId } from '@/data/providers/espnWeekQuery';

import { buildEspnWeekScoreboardUrl } from '@/data/providers/espnWeekQuery';
import {
  ESPN_FCS_SCOREBOARD_URL,
  ESPN_FBS_SCOREBOARD_URL,
  ESPN_SCOREBOARD_GROUP_FBS,
  ESPN_SCOREBOARD_GROUP_FCS,
  type EspnScoreboardGroupId,
} from '@/data/providers/espnWeekQuery';

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

/** Build ESPN scoreboard URL for a division group with optional date filter. */
export function buildEspnGroupScoreboardUrl(
  groupId: EspnScoreboardGroupId,
  dateIso?: string,
): string {
  const base =
    groupId === ESPN_SCOREBOARD_GROUP_FBS
      ? ESPN_FBS_SCOREBOARD_URL
      : ESPN_FCS_SCOREBOARD_URL;

  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return base;
  }
  return `${base}&dates=${formatEspnDateParam(dateIso)}`;
}

/** @deprecated Use buildEspnGroupScoreboardUrl — FCS-only alias. */
export function buildEspnFcsScoreboardUrl(dateIso?: string): string {
  return buildEspnGroupScoreboardUrl(ESPN_SCOREBOARD_GROUP_FCS, dateIso);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeGamesById(games: EspnNormalizedGame[]): EspnNormalizedGame[] {
  const byId = new Map<string, EspnNormalizedGame>();
  for (const game of games) {
    byId.set(game.id, game);
  }
  return [...byId.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

async function fetchScoreboardGames(
  endpoint: string,
  fetchOptions: FetchWithTimeoutOptions & { forceRefresh?: boolean },
): Promise<EspnScoreboardCachePayload> {
  const cacheKey = buildEspnEndpointCacheKey(endpoint);

  return getOrFetchEspnCached(
    cacheKey,
    async () => {
      const raw = await fetchEspnJson<unknown>(endpoint, fetchOptions);

      if (!isRecord(raw)) {
        throw new Error('ESPN returned invalid data: expected a JSON object.');
      }

      const parseResult = parseEspnScoreboardNormalized(raw);
      return { games: parseResult.games, raw: toRawRecord(raw) };
    },
    {
      forceRefresh: fetchOptions.forceRefresh,
      ttlMs: (payload) => resolveEspnCacheTtlMs(payload.games),
    },
  );
}

function resolveEspnWeekGroups(league: ScoresLeagueFilterId = 'fcs'): EspnScoreboardGroupId[] {
  switch (league) {
    case 'fbs':
      return [ESPN_SCOREBOARD_GROUP_FBS];
    case 'all':
      return [ESPN_SCOREBOARD_GROUP_FCS, ESPN_SCOREBOARD_GROUP_FBS];
    default:
      return [ESPN_SCOREBOARD_GROUP_FCS];
  }
}

async function loadWeekGamesPayloadForWeek(
  weekId: ScheduleWeekId,
  groupId: EspnScoreboardGroupId,
  fetchOptions: FetchWithTimeoutOptions & { forceRefresh?: boolean },
): Promise<EspnWeekGamesPayload> {
  const config = getScheduleWeekConfigForGroup(weekId, groupId);

  if (config.fetchStrategy === 'week_query') {
    const endpoint =
      config.scoreboardUrl ??
      (config.weekPresetId ? buildEspnWeekScoreboardUrl(config.weekPresetId) : undefined);

    if (!endpoint) {
      throw new Error(`No scoreboard URL configured for ${config.title}.`);
    }

    const { games: weekGames, raw } = await fetchScoreboardGames(endpoint, fetchOptions);
    const fallbackDates = config.dateRangeIso ?? [];

    if (weekGames.length === 0 && fallbackDates.length > 0) {
      const fallbackGames: EspnNormalizedGame[] = [];
      const rawResponses: Record<string, unknown>[] = [raw];

      for (const dateIso of fallbackDates) {
        const dateEndpoint = buildEspnGroupScoreboardUrl(groupId, dateIso);
        const { games, raw: dateRaw } = await fetchScoreboardGames(dateEndpoint, fetchOptions);
        fallbackGames.push(...games);
        rawResponses.push(dateRaw);
      }

      return {
        weekId,
        weekLabel: config.displayLabel,
        fetchStrategy: 'week_query',
        fetchNotes: `${config.fetchNotes} · date fallback ${fallbackDates.join(', ')}`,
        games: mergeGamesById(fallbackGames),
        endpoint: `${endpoint} | ${fallbackDates.map((date) => buildEspnGroupScoreboardUrl(groupId, date)).join(' | ')}`,
        raw: { strategy: 'week_query_with_date_fallback', week: raw, dates: rawResponses },
      };
    }

    return {
      weekId,
      weekLabel: config.displayLabel,
      fetchStrategy: 'week_query',
      fetchNotes: config.fetchNotes,
      games: weekGames,
      endpoint,
      raw,
    };
  }

  const dates = config.dateRangeIso ?? [];
  if (dates.length === 0) {
    throw new Error(`No fetch configuration for ${config.title}.`);
  }

  const endpoints: string[] = [];
  const mergedGames: EspnNormalizedGame[] = [];
  const rawResponses: Record<string, unknown>[] = [];

  for (const dateIso of dates) {
    const endpoint = buildEspnGroupScoreboardUrl(groupId, dateIso);
    endpoints.push(endpoint);
    const { games, raw } = await fetchScoreboardGames(endpoint, fetchOptions);
    mergedGames.push(...games);
    rawResponses.push(raw);
  }

  return {
    weekId,
    weekLabel: config.displayLabel,
    fetchStrategy: 'date_range',
    fetchNotes: config.fetchNotes,
    games: mergeGamesById(mergedGames),
    endpoint: endpoints.join(' | '),
    raw: { strategy: 'date_range', dates, responses: rawResponses },
  };
}

async function loadWeekGamesPayloadForVisibleWeek(
  weekId: ScheduleWeekId,
  groupId: EspnScoreboardGroupId,
  fetchOptions: FetchWithTimeoutOptions & { forceRefresh?: boolean },
): Promise<EspnWeekGamesPayload> {
  const sourceWeekIds = resolveEspnSourceWeekIds(weekId);

  if (sourceWeekIds.length === 1) {
    return loadWeekGamesPayloadForWeek(weekId, groupId, fetchOptions);
  }

  const displayConfig = getScheduleWeekConfigForGroup(weekId, groupId);
  const results = await Promise.all(
    sourceWeekIds.map((sourceWeekId) =>
      loadWeekGamesPayloadForWeek(sourceWeekId, groupId, fetchOptions),
    ),
  );

  return {
    weekId,
    weekLabel: displayConfig.displayLabel,
    fetchStrategy: 'week_query',
    fetchNotes: `Combined ESPN weeks 0+1 · ${results.map((result) => result.fetchNotes).join(' · ')}`,
    games: mergeGamesById(results.flatMap((result) => result.games)),
    endpoint: results.map((result) => result.endpoint).join(' | '),
    raw: {
      strategy: 'combined',
      sourceWeekIds,
      responses: results.map((result) => result.raw),
    },
  };
}

async function loadWeekGamesPayload(
  weekId: ScheduleWeekId,
  league: ScoresLeagueFilterId,
  fetchOptions: FetchWithTimeoutOptions & { forceRefresh?: boolean },
): Promise<EspnWeekGamesPayload> {
  const groupIds = resolveEspnWeekGroups(league);

  if (groupIds.length === 1) {
    return loadWeekGamesPayloadForVisibleWeek(weekId, groupIds[0], fetchOptions);
  }

  const displayConfig = getScheduleWeekConfig(weekId);
  const results = await Promise.all(
    groupIds.map((groupId) => loadWeekGamesPayloadForVisibleWeek(weekId, groupId, fetchOptions)),
  );

  return {
    weekId,
    weekLabel: displayConfig.displayLabel,
    fetchStrategy: 'week_query',
    fetchNotes: `FCS+FBS · ${results.map((result) => result.fetchNotes).join(' · ')}`,
    games: mergeGamesById(results.flatMap((result) => result.games)),
    endpoint: results.map((result) => result.endpoint).join(' | '),
    raw: {
      strategy: 'combined_leagues',
      league,
      responses: results.map((result) => result.raw),
    },
  };
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
    const fetchOptions: FetchWithTimeoutOptions & { forceRefresh?: boolean } = {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
      forceRefresh: options?.forceRefresh,
    };

    try {
      const { games, raw } = await fetchScoreboardGames(endpoint, fetchOptions);
      const date = extractEspnScoreboardDate(raw) ?? dateIso;

      const payload: EspnTodayGamesPayload = {
        date,
        games,
        raw,
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

  async getWeekGames(
    weekId: ScheduleWeekId,
    options?: EspnFetchOptions,
  ): Promise<ProviderResponse<EspnWeekGamesPayload>> {
    const start = Date.now();
    const league = options?.league ?? 'fcs';
    const fetchOptions: FetchWithTimeoutOptions & { forceRefresh?: boolean } = {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
      forceRefresh: options?.forceRefresh,
    };

    try {
      const payload = await getOrFetchEspnCached(
        buildEspnWeekCacheKey(weekId, league),
        () => loadWeekGamesPayload(weekId, league, fetchOptions),
        {
          forceRefresh: options?.forceRefresh,
          ttlMs: (data) => resolveEspnCacheTtlMs(data.games),
        },
      );

      return {
        providerId: this.id,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        data: payload,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown ESPN fetch error';
      console.log('[ESPN Provider] getWeekGames failed', weekId, message);
      throw err;
    }
  }
}

export const espnScoresProvider = new EspnScoresProviderImpl();

/** @deprecated Use espnScoresProvider */
export const espnProvider = espnScoresProvider;

/** @deprecated Use EspnScoresProviderImpl */
export const EspnProvider = EspnScoresProviderImpl;
