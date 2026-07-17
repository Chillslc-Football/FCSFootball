import { FCS_TEAM_ALIASES } from '@/data/static/teamAliases';
import { normalizeTeamName } from '@/data/providers/teamNameMatch';
import type { FavoriteTeam } from '@/types/favorites';
import type { EspnNormalizedGame } from '@/types';
import { isEspnTeamId, normalizeEspnTeamId, slugifyTeamName } from '@/utils/teamId';

export type TeamFavoriteLookupSide = {
  teamId?: string;
  teamName?: string;
  abbreviation?: string;
};

export type FavoriteTeamIdentity = {
  espnTeamId: string;
  name: string;
  abbreviation?: string;
  canonicalName: string;
};

/** Resolve poll / ESPN variants to a canonical school name when aliased. */
export function resolveCanonicalTeamName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const normalized = normalizeTeamName(trimmed);
  const aliasTarget = FCS_TEAM_ALIASES[normalized];
  return aliasTarget ?? trimmed;
}

export function normalizedCanonicalTeamKey(name: string): string {
  return normalizeTeamName(resolveCanonicalTeamName(name));
}

function normalizeAbbreviation(value?: string): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  return trimmed || undefined;
}

function favoriteEspnId(favorite: FavoriteTeam): string | undefined {
  return normalizeEspnTeamId(favorite.espnTeamId) ?? normalizeEspnTeamId(favorite.key);
}

function sideEspnId(side: TeamFavoriteLookupSide): string | undefined {
  return normalizeEspnTeamId(side.teamId);
}

/** Build lookup tables from cached ESPN games for legacy favorite migration. */
export function buildFavoriteTeamIdentityLookup(
  games: EspnNormalizedGame[],
): Map<string, FavoriteTeamIdentity> {
  const byEspnId = new Map<string, FavoriteTeamIdentity>();

  function register(side: TeamFavoriteLookupSide) {
    const espnTeamId = sideEspnId(side);
    const teamName = side.teamName?.trim();
    if (!espnTeamId || !teamName) return;

    const canonicalName = resolveCanonicalTeamName(teamName);
    byEspnId.set(espnTeamId, {
      espnTeamId,
      name: teamName,
      abbreviation: side.abbreviation,
      canonicalName,
    });
  }

  for (const game of games) {
    register({
      teamId: game.awayTeamId,
      teamName: game.awayTeam,
      abbreviation: game.awayAbbreviation,
    });
    register({
      teamId: game.homeTeamId,
      teamName: game.homeTeam,
      abbreviation: game.homeAbbreviation,
    });
  }

  return byEspnId;
}

export function resolveFavoriteIdentityFromLookup(
  favorite: FavoriteTeam,
  lookup: Map<string, FavoriteTeamIdentity>,
): FavoriteTeamIdentity | undefined {
  const existingId = favoriteEspnId(favorite);
  if (existingId) {
    return lookup.get(existingId);
  }

  const favoriteAbbr = normalizeAbbreviation(favorite.abbreviation);
  const favoriteCanonical = normalizedCanonicalTeamKey(favorite.name);

  for (const identity of lookup.values()) {
    if (favoriteAbbr && normalizeAbbreviation(identity.abbreviation) === favoriteAbbr) {
      return identity;
    }

    if (favoriteCanonical === normalizedCanonicalTeamKey(identity.name)) {
      return identity;
    }

    if (
      !isEspnTeamId(favorite.key) &&
      (favorite.key === slugifyTeamName(identity.name) ||
        favorite.key === slugifyTeamName(identity.canonicalName))
    ) {
      return identity;
    }
  }

  return undefined;
}

/** Upgrade legacy favorites with stable ESPN IDs when resolvable. */
export function migrateLegacyFavoriteTeam(
  favorite: FavoriteTeam,
  lookup: Map<string, FavoriteTeamIdentity>,
): FavoriteTeam {
  const existingId = favoriteEspnId(favorite);
  if (existingId) {
    const identity = lookup.get(existingId);
    return {
      ...favorite,
      key: existingId,
      espnTeamId: existingId,
      name: favorite.name || identity?.name || favorite.name,
      abbreviation: favorite.abbreviation ?? identity?.abbreviation,
    };
  }

  const resolved = resolveFavoriteIdentityFromLookup(favorite, lookup);
  if (!resolved) {
    return favorite;
  }

  return {
    ...favorite,
    key: resolved.espnTeamId,
    espnTeamId: resolved.espnTeamId,
    name: favorite.name || resolved.name,
    abbreviation: favorite.abbreviation ?? resolved.abbreviation,
  };
}

export function dedupeFavoriteTeams(teams: FavoriteTeam[]): FavoriteTeam[] {
  const deduped: FavoriteTeam[] = [];

  for (const team of teams) {
    const index = deduped.findIndex((existing) => teamSideMatchesFavorite(existing, {
      teamId: team.espnTeamId ?? team.key,
      teamName: team.name,
      abbreviation: team.abbreviation,
    }));

    if (index < 0) {
      deduped.push(team);
      continue;
    }

    const existing = deduped[index];
    deduped[index] = {
      ...existing,
      espnTeamId: favoriteEspnId(existing) ?? favoriteEspnId(team),
      key: favoriteEspnId(existing) ?? favoriteEspnId(team) ?? existing.key,
      abbreviation: existing.abbreviation ?? team.abbreviation,
      logoUrl: existing.logoUrl ?? team.logoUrl,
      conference: existing.conference ?? team.conference,
      rank: existing.rank ?? team.rank,
      record: existing.record ?? team.record,
      savedAt: existing.savedAt || team.savedAt,
    };
  }

  return deduped;
}

/**
 * Match priority:
 * 1. Stable normalized ESPN team ID
 * 2. Normalized abbreviation
 * 3. Normalized canonical team name (alias-aware)
 */
export function teamSideMatchesFavorite(
  favorite: FavoriteTeam,
  side: TeamFavoriteLookupSide,
): boolean {
  const queryId = sideEspnId(side);
  const favId = favoriteEspnId(favorite);

  if (queryId && favId && queryId === favId) {
    return true;
  }

  const sideAbbr = normalizeAbbreviation(side.abbreviation);
  const favAbbr = normalizeAbbreviation(favorite.abbreviation);
  if (sideAbbr && favAbbr && sideAbbr === favAbbr) {
    return true;
  }

  const sideName = side.teamName?.trim();
  const favName = favorite.name?.trim();
  if (sideName && favName) {
    if (normalizedCanonicalTeamKey(sideName) === normalizedCanonicalTeamKey(favName)) {
      return true;
    }
  }

  if (sideName && favorite.key && !isEspnTeamId(favorite.key)) {
    const sideSlug = slugifyTeamName(resolveCanonicalTeamName(sideName));
    if (sideSlug === favorite.key || slugifyTeamName(sideName) === favorite.key) {
      return true;
    }
  }

  if (queryId && favorite.key === queryId) {
    return true;
  }

  return false;
}

export function isTeamFavorite(
  favorites: FavoriteTeam[],
  side: TeamFavoriteLookupSide,
): boolean {
  return favorites.some((favorite) => teamSideMatchesFavorite(favorite, side));
}
