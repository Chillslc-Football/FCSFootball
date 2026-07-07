import { normalizeTeamName } from '@/data/providers/teamNameMatch';
import { resolveEspnConferenceName } from '@/data/providers/espnConferenceLookup';
import type { EspnNormalizedGame } from '@/types';
import { isEspnTeamId, slugifyTeamName } from '@/utils/teamId';

export type PickableFavoriteTeam = {
  key: string;
  espnTeamId?: string;
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  conference?: string;
  rank?: number;
  record?: string;
};

function resolveConferenceLabel(raw?: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) {
    return resolveEspnConferenceName(trimmed) ?? trimmed;
  }
  return trimmed;
}

function upsertTeam(
  map: Map<string, PickableFavoriteTeam>,
  entry: Omit<PickableFavoriteTeam, 'key'> & { teamId?: string },
): void {
  const name = entry.name?.trim();
  if (!name) return;

  const key = entry.teamId && isEspnTeamId(entry.teamId) ? entry.teamId : slugifyTeamName(name);
  const existing = map.get(key);

  map.set(key, {
    key,
    espnTeamId: entry.teamId && isEspnTeamId(entry.teamId) ? entry.teamId : existing?.espnTeamId,
    name,
    abbreviation: entry.abbreviation ?? existing?.abbreviation,
    logoUrl: entry.logoUrl ?? existing?.logoUrl,
    conference: resolveConferenceLabel(entry.conference) ?? existing?.conference,
    rank: entry.rank ?? existing?.rank,
    record: entry.record ?? existing?.record,
  });
}

/** Unique teams from loaded ESPN season scoreboard games (with merged poll ranks). */
export function buildPickableTeamsFromGames(games: EspnNormalizedGame[]): PickableFavoriteTeam[] {
  const byKey = new Map<string, PickableFavoriteTeam>();

  for (const game of games) {
    upsertTeam(byKey, {
      teamId: game.awayTeamId,
      name: game.awayTeam,
      abbreviation: game.awayAbbreviation,
      logoUrl: game.awayLogoUrl,
      conference: game.awayConference,
      rank: game.awayIsRanked ? game.awayRank : undefined,
      record: game.awayRecord,
    });
    upsertTeam(byKey, {
      teamId: game.homeTeamId,
      name: game.homeTeam,
      abbreviation: game.homeAbbreviation,
      logoUrl: game.homeLogoUrl,
      conference: game.homeConference,
      rank: game.homeIsRanked ? game.homeRank : undefined,
      record: game.homeRecord,
    });
  }

  return [...byKey.values()].sort((a, b) => {
    const aRank = a.rank ?? Number.POSITIVE_INFINITY;
    const bRank = b.rank ?? Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function filterPickableTeams(
  teams: PickableFavoriteTeam[],
  query: string,
): PickableFavoriteTeam[] {
  const normalizedQuery = normalizeTeamName(query);
  if (!normalizedQuery) return teams;

  return teams.filter((team) => {
    const haystack = [
      team.name,
      team.abbreviation,
      team.conference,
      team.rank != null ? `#${team.rank}` : '',
    ]
      .filter(Boolean)
      .map((part) => normalizeTeamName(String(part)))
      .join(' ');

    return haystack.includes(normalizedQuery);
  });
}

export function pickableTeamToFavorite(team: PickableFavoriteTeam) {
  return {
    key: team.key,
    espnTeamId: team.espnTeamId,
    name: team.name,
    abbreviation: team.abbreviation,
    logoUrl: team.logoUrl,
    conference: team.conference,
    rank: team.rank,
    record: team.record,
    savedAt: new Date().toISOString(),
  };
}
