import { fetchEspnJson, type FetchWithTimeoutOptions } from '@/data/providers/espnFetch';
import { getOrFetchEspnCached } from '@/data/providers/espnCache';

const ESPN_FBS_RANKINGS_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings';

const ESPN_AP_TOP_25_CACHE_KEY = 'espn:rankings:ap-top-25';
const ESPN_AP_TOP_25_CACHE_TTL_MS = 5 * 60_000;

export type EspnFbsRankLookup = {
  pollName: string;
  byTeamId: Map<string, number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function asIdString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return undefined;
}

/** ESPN uses 99 or missing values to mean unranked — only 1–25 count. */
export function isEspnFbsTop25Rank(rank: number | undefined | null): boolean {
  return rank != null && rank >= 1 && rank <= 25;
}

function parsePollRankValue(entry: Record<string, unknown>): number | undefined {
  const rank = asNumber(entry.current) ?? asNumber(entry.rank);
  return isEspnFbsTop25Rank(rank) ? rank : undefined;
}

function parseApTop25Lookup(raw: unknown): EspnFbsRankLookup {
  const byTeamId = new Map<string, number>();
  let pollName = 'AP Top 25';

  if (!isRecord(raw)) {
    return { pollName, byTeamId };
  }

  const rankings = raw.rankings;
  if (!Array.isArray(rankings)) {
    return { pollName, byTeamId };
  }

  const apPoll =
    rankings.find((entry) => {
      if (!isRecord(entry)) return false;
      const name = String(entry.name ?? entry.shortName ?? '').toLowerCase();
      return name.includes('ap top 25') || name === 'ap top 25';
    }) ?? rankings.find((entry) => isRecord(entry));

  if (!isRecord(apPoll)) {
    return { pollName, byTeamId };
  }

  pollName = String(apPoll.name ?? apPoll.shortName ?? pollName);
  const ranks = apPoll.ranks ?? apPoll.entries;
  if (!Array.isArray(ranks)) {
    return { pollName, byTeamId };
  }

  for (const entry of ranks) {
    if (!isRecord(entry)) continue;
    const rank = parsePollRankValue(entry);
    if (rank == null) continue;

    const team = isRecord(entry.team) ? entry.team : undefined;
    const teamId = team ? asIdString(team.id) : undefined;
    if (teamId) {
      byTeamId.set(teamId, rank);
    }
  }

  return { pollName, byTeamId };
}

async function loadEspnApTop25Lookup(
  fetchOptions: FetchWithTimeoutOptions = {},
): Promise<EspnFbsRankLookup> {
  const raw = await fetchEspnJson<unknown>(ESPN_FBS_RANKINGS_URL, fetchOptions);
  return parseApTop25Lookup(raw);
}

export async function fetchEspnApTop25Lookup(
  fetchOptions: FetchWithTimeoutOptions & { forceRefresh?: boolean } = {},
): Promise<EspnFbsRankLookup> {
  return getOrFetchEspnCached(
    ESPN_AP_TOP_25_CACHE_KEY,
    () => loadEspnApTop25Lookup(fetchOptions),
    {
      forceRefresh: fetchOptions.forceRefresh,
      ttlMs: ESPN_AP_TOP_25_CACHE_TTL_MS,
    },
  );
}

export function resolveEspnFbsTeamRank(
  teamId: string | undefined,
  parsedCuratedRank: number | undefined,
  lookup: EspnFbsRankLookup,
): number | undefined {
  if (isEspnFbsTop25Rank(parsedCuratedRank)) {
    return parsedCuratedRank;
  }

  if (teamId) {
    const fromPoll = lookup.byTeamId.get(teamId);
    if (isEspnFbsTop25Rank(fromPoll)) {
      return fromPoll;
    }
  }

  return undefined;
}
