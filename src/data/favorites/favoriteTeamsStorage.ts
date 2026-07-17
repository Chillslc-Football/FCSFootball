import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  buildFavoriteTeamIdentityLookup,
  dedupeFavoriteTeams,
  migrateLegacyFavoriteTeam,
  teamSideMatchesFavorite,
} from '@/data/favorites/favoriteTeamMatch';
import { getAllCachedEspnGames } from '@/data/teams/teamGamesStore';
import type { FavoriteTeam } from '@/types/favorites';
import { normalizeEspnTeamId, slugifyTeamName } from '@/utils/teamId';
import type { TeamProfile } from '@/data/teams/loadTeamSeasonGames';

const STORAGE_KEY = 'fcsfootball.favoriteTeams.v1';

/** In-memory fallback when AsyncStorage is unavailable or fails. */
let memoryFallback: FavoriteTeam[] = [];

function isAsyncStorageReady(): boolean {
  return (
    typeof AsyncStorage?.getItem === 'function' &&
    typeof AsyncStorage?.setItem === 'function'
  );
}

function normalizeFavoriteTeam(value: unknown): FavoriteTeam | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const keyRaw = typeof record.key === 'string' ? record.key.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!keyRaw || !name) return null;

  const espnTeamId =
    normalizeEspnTeamId(record.espnTeamId) ?? normalizeEspnTeamId(keyRaw);
  const key = espnTeamId ?? keyRaw;

  return {
    key,
    espnTeamId,
    name,
    abbreviation: typeof record.abbreviation === 'string' ? record.abbreviation : undefined,
    logoUrl: typeof record.logoUrl === 'string' ? record.logoUrl : undefined,
    conference: typeof record.conference === 'string' ? record.conference : undefined,
    rank: typeof record.rank === 'number' ? record.rank : undefined,
    record: typeof record.record === 'string' ? record.record : undefined,
    savedAt:
      typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
  };
}

function migrateLoadedFavorites(teams: FavoriteTeam[]): FavoriteTeam[] {
  const lookup = buildFavoriteTeamIdentityLookup(getAllCachedEspnGames());
  const migrated = teams.map((team) => migrateLegacyFavoriteTeam(team, lookup));
  return dedupeFavoriteTeams(migrated);
}

export function favoriteTeamFromProfile(profile: TeamProfile, routeId: string): FavoriteTeam {
  const espnTeamId = normalizeEspnTeamId(profile.espnTeamId) ?? normalizeEspnTeamId(routeId);
  return {
    key: espnTeamId ?? routeId,
    espnTeamId,
    name: profile.displayName,
    abbreviation: profile.abbreviation,
    logoUrl: profile.logoUrl,
    conference: profile.conference,
    rank: profile.rank,
    record: profile.record,
    savedAt: new Date().toISOString(),
  };
}

export function favoriteTeamFromEspnSide(side: {
  teamId?: string;
  teamName: string;
  abbreviation?: string;
  logoUrl?: string;
  conference?: string;
  rank?: number;
  record?: string;
}): FavoriteTeam {
  const normalizedTeamId = normalizeEspnTeamId(side.teamId);
  const key = normalizedTeamId ?? slugifyTeamName(side.teamName);
  return {
    key,
    espnTeamId: normalizedTeamId,
    name: side.teamName,
    abbreviation: side.abbreviation,
    logoUrl: side.logoUrl,
    conference: side.conference,
    rank: side.rank,
    record: side.record,
    savedAt: new Date().toISOString(),
  };
}

export function favoriteTeamMatchesStored(
  favorite: FavoriteTeam,
  teamId?: string,
  teamName?: string,
  abbreviation?: string,
): boolean {
  try {
    return teamSideMatchesFavorite(favorite, { teamId, teamName, abbreviation });
  } catch (error) {
    console.warn('[favoriteTeamsStorage] favoriteTeamMatchesStored failed:', error);
    return false;
  }
}

export async function loadFavoriteTeams(): Promise<FavoriteTeam[]> {
  if (!isAsyncStorageReady()) {
    console.warn('[favoriteTeamsStorage] AsyncStorage is not available; using in-memory favorites');
    return migrateLoadedFavorites([...memoryFallback]);
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') {
      memoryFallback = [];
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      console.warn('[favoriteTeamsStorage] invalid favorites JSON:', parseError);
      memoryFallback = [];
      return [];
    }

    if (!Array.isArray(parsed)) {
      console.warn('[favoriteTeamsStorage] favorites payload is not an array');
      memoryFallback = [];
      return [];
    }

    const teams = parsed
      .map(normalizeFavoriteTeam)
      .filter((team): team is FavoriteTeam => team != null);

    const migrated = migrateLoadedFavorites(teams);
    memoryFallback = migrated;

    const needsPersist = JSON.stringify(teams) !== JSON.stringify(migrated);
    if (needsPersist) {
      await saveFavoriteTeams(migrated);
    }

    return migrated;
  } catch (error) {
    console.warn('[favoriteTeamsStorage] loadFavoriteTeams failed:', error);
    return migrateLoadedFavorites([...memoryFallback]);
  }
}

export async function saveFavoriteTeams(teams: FavoriteTeam[]): Promise<void> {
  memoryFallback = teams;

  if (!isAsyncStorageReady()) {
    console.warn('[favoriteTeamsStorage] AsyncStorage is not available; favorites kept in memory only');
    return;
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  } catch (error) {
    console.warn('[favoriteTeamsStorage] saveFavoriteTeams failed:', error);
  }
}

export async function addFavoriteTeam(
  team: FavoriteTeam,
  current?: FavoriteTeam[],
): Promise<FavoriteTeam[]> {
  try {
    const existing = current ?? (await loadFavoriteTeams());
    const alreadySaved = existing.some((entry) =>
      favoriteTeamMatchesStored(entry, team.espnTeamId ?? team.key, team.name, team.abbreviation),
    );

    if (alreadySaved) {
      return existing;
    }

    const next = dedupeFavoriteTeams([
      ...existing,
      { ...team, savedAt: new Date().toISOString() },
    ]);
    await saveFavoriteTeams(next);
    return next;
  } catch (error) {
    console.warn('[favoriteTeamsStorage] addFavoriteTeam failed:', error);
    return current ?? loadFavoriteTeams();
  }
}

export async function toggleFavoriteTeam(
  team: FavoriteTeam,
  current?: FavoriteTeam[],
): Promise<FavoriteTeam[]> {
  try {
    const existing = current ?? (await loadFavoriteTeams());
    const index = existing.findIndex((entry) =>
      favoriteTeamMatchesStored(entry, team.espnTeamId ?? team.key, team.name, team.abbreviation),
    );

    const next =
      index >= 0
        ? existing.filter((_, i) => i !== index)
        : dedupeFavoriteTeams([
            ...existing,
            { ...team, savedAt: new Date().toISOString() },
          ]);

    await saveFavoriteTeams(next);
    return next;
  } catch (error) {
    console.warn('[favoriteTeamsStorage] toggleFavoriteTeam failed:', error);
    return current ?? loadFavoriteTeams();
  }
}
