import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FavoriteTeam } from '@/types/favorites';
import { teamMatchesKey } from '@/utils/teamId';
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
  const key = typeof record.key === 'string' ? record.key.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!key || !name) return null;

  return {
    key,
    espnTeamId: typeof record.espnTeamId === 'string' ? record.espnTeamId : undefined,
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

export function favoriteTeamFromProfile(profile: TeamProfile, routeId: string): FavoriteTeam {
  return {
    key: profile.espnTeamId ?? routeId,
    espnTeamId: profile.espnTeamId,
    name: profile.displayName,
    abbreviation: profile.abbreviation,
    logoUrl: profile.logoUrl,
    conference: profile.conference,
    rank: profile.rank,
    record: profile.record,
    savedAt: new Date().toISOString(),
  };
}

export function favoriteTeamMatchesStored(
  favorite: FavoriteTeam,
  teamKey: string,
  teamName?: string,
): boolean {
  try {
    const key = decodeURIComponent(teamKey);
    if (favorite.key === key || favorite.espnTeamId === key) return true;
    if (teamName && teamMatchesKey(favorite.espnTeamId, favorite.name, key)) return true;
    if (teamName && teamMatchesKey(undefined, teamName, favorite.key)) return true;
    return false;
  } catch (error) {
    console.warn('[favoriteTeamsStorage] favoriteTeamMatchesStored failed:', error);
    return false;
  }
}

export async function loadFavoriteTeams(): Promise<FavoriteTeam[]> {
  if (!isAsyncStorageReady()) {
    console.warn('[favoriteTeamsStorage] AsyncStorage is not available; using in-memory favorites');
    return [...memoryFallback];
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

    memoryFallback = teams;
    return teams;
  } catch (error) {
    console.warn('[favoriteTeamsStorage] loadFavoriteTeams failed:', error);
    return [...memoryFallback];
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

export async function toggleFavoriteTeam(
  team: FavoriteTeam,
  current?: FavoriteTeam[],
): Promise<FavoriteTeam[]> {
  try {
    const existing = current ?? (await loadFavoriteTeams());
    const index = existing.findIndex((entry) =>
      favoriteTeamMatchesStored(entry, team.key, team.name),
    );

    const next =
      index >= 0
        ? existing.filter((_, i) => i !== index)
        : [...existing, { ...team, savedAt: new Date().toISOString() }];

    await saveFavoriteTeams(next);
    return next;
  } catch (error) {
    console.warn('[favoriteTeamsStorage] toggleFavoriteTeam failed:', error);
    return current ?? loadFavoriteTeams();
  }
}
