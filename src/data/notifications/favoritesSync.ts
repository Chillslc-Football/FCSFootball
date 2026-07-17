import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';
import { registerDeviceWithBackend } from '@/data/notifications/deviceRegistration';
import { isEspnTeamId } from '@/utils/teamId';
import type { FavoriteTeam } from '@/types/favorites';
import { getOrCreateDeviceId } from '@/services/notifications/deviceIdentity';

export type SyncableFavorite = {
  espnTeamId: string;
  teamName: string;
};

export function favoriteToSyncable(favorite: FavoriteTeam): SyncableFavorite | null {
  const espnTeamId = favorite.espnTeamId ?? (isEspnTeamId(favorite.key) ? favorite.key : undefined);
  if (!espnTeamId || !isEspnTeamId(espnTeamId)) {
    return null;
  }

  return {
    espnTeamId,
    teamName: favorite.name,
  };
}

export function isFavoriteEligibleForNotifications(favorite: FavoriteTeam): boolean {
  return favoriteToSyncable(favorite) != null;
}

export async function syncFavoritesToBackend(favorites: FavoriteTeam[]): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const deviceUuid = await getOrCreateDeviceId();
  const syncable = favorites
    .map(favoriteToSyncable)
    .filter((item): item is SyncableFavorite => item != null)
    .map((item) => ({
      espn_team_id: item.espnTeamId,
      team_name: item.teamName,
    }));

  const { error } = await supabase.rpc('sync_device_favorites', {
    p_device_uuid: deviceUuid,
    p_favorites: syncable,
  });

  if (error) {
    console.warn('[favoritesSync] sync_device_favorites failed:', error.message);
  }
}

export async function reconcileFavoritesOnLaunch(favorites: FavoriteTeam[]): Promise<void> {
  await registerDeviceWithBackend({ requestPermission: false });
  await syncFavoritesToBackend(favorites);
}
