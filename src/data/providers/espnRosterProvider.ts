import {
  getEspnCacheEntry,
  getOrFetchEspnCached,
  setEspnCacheEntry,
} from '@/data/providers/espnCache';
import { fetchEspnJson, type FetchWithTimeoutOptions } from '@/data/providers/espnFetch';
import {
  parseEspnTeamRoster,
  type EspnTeamRoster,
} from '@/data/providers/espnRosterParser';
import type { ProviderResponse } from '@/data/providers/types';

const ESPN_ROSTER_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams';

/** Rosters change infrequently — hours, not seconds. */
export const ESPN_ROSTER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function buildEspnRosterUrl(teamId: string): string {
  return `${ESPN_ROSTER_BASE}/${encodeURIComponent(teamId.trim())}/roster`;
}

export function buildEspnRosterCacheKey(teamId: string): string {
  return `espn:roster:${teamId.trim()}`;
}

export async function fetchEspnTeamRoster(
  teamId: string,
  options: FetchWithTimeoutOptions & { forceRefresh?: boolean } = {},
): Promise<ProviderResponse<EspnTeamRoster>> {
  const trimmed = teamId.trim();
  const started = Date.now();

  if (!trimmed) {
    return {
      data: { teamId: '', groups: [], players: [] },
      durationMs: Date.now() - started,
      providerId: 'espn-roster',
      timestamp: new Date().toISOString(),
    };
  }

  const cacheKey = buildEspnRosterCacheKey(trimmed);
  const endpoint = buildEspnRosterUrl(trimmed);
  // Capture before forceRefresh clears the entry so a failed refresh can keep UI.
  const previous = getEspnCacheEntry<EspnTeamRoster>(cacheKey);

  try {
    const roster = await getOrFetchEspnCached(
      cacheKey,
      async () => {
        const raw = await fetchEspnJson<unknown>(endpoint, options);
        return parseEspnTeamRoster(raw, trimmed);
      },
      {
        forceRefresh: options.forceRefresh,
        ttlMs: ESPN_ROSTER_CACHE_TTL_MS,
      },
    );

    return {
      data: roster,
      durationMs: Date.now() - started,
      providerId: 'espn-roster',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (previous) {
      setEspnCacheEntry(cacheKey, previous, ESPN_ROSTER_CACHE_TTL_MS);
      return {
        data: previous,
        durationMs: Date.now() - started,
        providerId: 'espn-roster',
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
}
