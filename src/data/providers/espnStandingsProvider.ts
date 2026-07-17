import type { ConferenceId } from '@/data/conferences/conferenceList';
import { resolveConferenceEspnGroupId } from '@/data/conferences/conferenceEspnGroupIds';
import {
  getOrFetchEspnCached,
  ESPN_CACHE_TTL_DEFAULT_MS,
} from '@/data/providers/espnCache';
import { fetchEspnJson, type FetchWithTimeoutOptions } from '@/data/providers/espnFetch';
import {
  parseEspnConferenceStandings,
  sortConferenceStandings,
} from '@/data/providers/espnStandingsParser';
import type { ProviderResponse } from '@/data/providers/types';
import type { ConferenceStandingsPayload } from '@/types';

const ESPN_STANDINGS_BASE =
  'https://site.api.espn.com/apis/v2/sports/football/college-football/standings';

function buildStandingsCacheKey(conferenceId: ConferenceId, groupId: string): string {
  return `espn:standings:${conferenceId}:${groupId}`;
}

function buildStandingsUrl(groupId: string): string {
  return `${ESPN_STANDINGS_BASE}?group=${groupId}`;
}

export async function fetchConferenceStandings(
  conferenceId: ConferenceId,
  options: FetchWithTimeoutOptions & { forceRefresh?: boolean } = {},
): Promise<ProviderResponse<ConferenceStandingsPayload>> {
  const started = Date.now();
  const groupId = resolveConferenceEspnGroupId(conferenceId);

  if (!groupId) {
    return {
      data: {
        conferenceId,
        entries: [],
        unavailable: true,
      },
      durationMs: Date.now() - started,
      providerId: 'espn-standings',
      timestamp: new Date().toISOString(),
    };
  }

  const endpoint = buildStandingsUrl(groupId);
  const cacheKey = buildStandingsCacheKey(conferenceId, groupId);

  const parsed = await getOrFetchEspnCached(
    cacheKey,
    async () => {
      const raw = await fetchEspnJson<unknown>(endpoint, options);
      const result = parseEspnConferenceStandings(raw);
      return {
        ...result,
        entries: sortConferenceStandings(result.entries),
      };
    },
    {
      forceRefresh: options.forceRefresh,
      ttlMs: ESPN_CACHE_TTL_DEFAULT_MS,
    },
  );

  return {
    data: {
      conferenceId,
      conferenceName: parsed.conferenceName,
      entries: parsed.entries,
      unavailable: parsed.entries.length === 0,
    },
    durationMs: Date.now() - started,
    providerId: 'espn-standings',
    timestamp: new Date().toISOString(),
  };
}
