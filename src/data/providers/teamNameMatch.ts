import { FCS_TEAM_ALIASES } from '@/data/static/teamAliases';
import type { RankedTeam } from '@/types';

/** Lowercase, strip punctuation/parentheses, collapse whitespace. */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type RankLookup = {
  /** Normalized poll name → rank (best rank when tied) */
  byNormalizedPollName: Map<string, number>;
  /** Exact poll name (original casing) → rank */
  byExactPollName: Map<string, number>;
  /** Poll entries for prefix matching */
  pollEntries: { pollName: string; normalized: string; rank: number }[];
};

export function buildRankLookup(rankings: RankedTeam[]): RankLookup {
  const byNormalizedPollName = new Map<string, number>();
  const byExactPollName = new Map<string, number>();
  const pollEntries: RankLookup['pollEntries'] = [];

  for (const entry of rankings) {
    const pollName = entry.team.name;
    const normalized = normalizeTeamName(pollName);
    const existingNorm = byNormalizedPollName.get(normalized);
    if (existingNorm == null || entry.rank < existingNorm) {
      byNormalizedPollName.set(normalized, entry.rank);
    }
    byExactPollName.set(pollName, entry.rank);
    pollEntries.push({ pollName, normalized, rank: entry.rank });
  }

  return { byNormalizedPollName, byExactPollName, pollEntries };
}

function setBestRank(map: Map<string, number>, key: string, rank: number): void {
  const existing = map.get(key);
  if (existing == null || rank < existing) {
    map.set(key, rank);
  }
}

/** Register alias keys pointing at a poll name's rank. */
export function registerAliasKeys(lookup: RankLookup): void {
  for (const [aliasKey, pollName] of Object.entries(FCS_TEAM_ALIASES)) {
    const rank = lookup.byExactPollName.get(pollName);
    if (rank == null) continue;
    setBestRank(lookup.byNormalizedPollName, aliasKey, rank);
  }
}

/**
 * Resolve poll rank for an ESPN team name.
 * Order: exact → normalized → alias → prefix (ESPN name starts with poll name).
 */
export function lookupTeamRank(espnTeamName: string, lookup: RankLookup): number | undefined {
  const trimmed = espnTeamName.trim();
  if (!trimmed) return undefined;

  const exactLower = trimmed.toLowerCase();
  const fromExact = lookup.byExactPollName.get(trimmed);
  if (fromExact != null) return fromExact;

  const normalized = normalizeTeamName(trimmed);
  const fromNormalized = lookup.byNormalizedPollName.get(normalized);
  if (fromNormalized != null) return fromNormalized;

  const aliasPollName = FCS_TEAM_ALIASES[normalized];
  if (aliasPollName) {
    const fromAlias = lookup.byExactPollName.get(aliasPollName);
    if (fromAlias != null) return fromAlias;
  }

  for (const entry of lookup.pollEntries) {
    if (normalized === entry.normalized) return entry.rank;
    if (normalized.startsWith(`${entry.normalized} `)) return entry.rank;
  }

  return undefined;
}
