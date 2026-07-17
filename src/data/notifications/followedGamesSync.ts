import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';
import type { FollowedGameRecord } from '@/data/notifications/types';
import {
  loadFollowedGamesLocal,
  removeFollowedGameLocal,
  saveFollowedGamesLocal,
  upsertFollowedGameLocal,
} from '@/data/notifications/followedGamesStorage';
import { getOrCreateDeviceId } from '@/services/notifications/deviceIdentity';
import type { EspnNormalizedGame } from '@/types';

const FINAL_EXPIRY_MS = 24 * 60 * 60 * 1000;

function buildFollowedGameRecord(game: EspnNormalizedGame): FollowedGameRecord {
  const kickoffAt = game.startTime;
  const isFinal = game.normalizedStatus === 'final';
  const expiresAt = isFinal
    ? new Date(Date.now() + FINAL_EXPIRY_MS).toISOString()
    : undefined;

  return {
    eventId: game.id,
    awayTeamId: game.awayTeamId,
    homeTeamId: game.homeTeamId,
    awayTeamName: game.awayTeam,
    homeTeamName: game.homeTeam,
    kickoffAt,
    notificationsEnabled: true,
    expiresAt,
  };
}

export async function enableGameAlerts(game: EspnNormalizedGame): Promise<FollowedGameRecord[]> {
  const record = buildFollowedGameRecord(game);
  const local = await upsertFollowedGameLocal(record);

  if (!isSupabaseConfigured()) {
    return local;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return local;

  const deviceUuid = await getOrCreateDeviceId();
  const { error } = await supabase.rpc('upsert_followed_game', {
    p_device_uuid: deviceUuid,
    p_event_id: record.eventId,
    p_away_team_id: record.awayTeamId ?? null,
    p_home_team_id: record.homeTeamId ?? null,
    p_away_team_name: record.awayTeamName,
    p_home_team_name: record.homeTeamName,
    p_kickoff_at: record.kickoffAt,
    p_notifications_enabled: true,
    p_expires_at: record.expiresAt ?? null,
  });

  if (error) {
    console.warn('[followedGamesSync] upsert_followed_game failed:', error.message);
  }

  return local;
}

export async function disableGameAlerts(eventId: string): Promise<FollowedGameRecord[]> {
  const local = await removeFollowedGameLocal(eventId);

  if (!isSupabaseConfigured()) {
    return local;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return local;

  const deviceUuid = await getOrCreateDeviceId();
  const { error } = await supabase.rpc('remove_followed_game', {
    p_device_uuid: deviceUuid,
    p_event_id: eventId,
  });

  if (error) {
    console.warn('[followedGamesSync] remove_followed_game failed:', error.message);
  }

  return local;
}

export async function loadFollowedGames(): Promise<FollowedGameRecord[]> {
  const local = await loadFollowedGamesLocal();

  if (!isSupabaseConfigured()) {
    return local;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return local;

  const deviceUuid = await getOrCreateDeviceId();
  const { data, error } = await supabase.rpc('list_followed_games', {
    p_device_uuid: deviceUuid,
  });

  if (error || !Array.isArray(data)) {
    return local;
  }

  const remote: FollowedGameRecord[] = [];
  for (const row of data) {
    if (typeof row !== 'object' || row === null) continue;
    const record = row as Record<string, unknown>;
    const eventId = typeof record.event_id === 'string' ? record.event_id : '';
    const awayTeamName = typeof record.away_team_name === 'string' ? record.away_team_name : '';
    const homeTeamName = typeof record.home_team_name === 'string' ? record.home_team_name : '';
    if (!eventId || !awayTeamName || !homeTeamName) continue;

    remote.push({
      eventId,
      awayTeamId: typeof record.away_team_id === 'string' ? record.away_team_id : undefined,
      homeTeamId: typeof record.home_team_id === 'string' ? record.home_team_id : undefined,
      awayTeamName,
      homeTeamName,
      kickoffAt: typeof record.kickoff_at === 'string' ? record.kickoff_at : '',
      notificationsEnabled: record.notifications_enabled !== false,
      expiresAt: typeof record.expires_at === 'string' ? record.expires_at : undefined,
    });
  }

  const merged = new Map<string, FollowedGameRecord>();
  for (const record of [...local, ...remote]) {
    merged.set(record.eventId, record);
  }

  const next = [...merged.values()];
  await saveFollowedGamesLocal(next);
  return next;
}

export function isGameFollowed(eventId: string, records: FollowedGameRecord[]): boolean {
  return records.some((record) => record.eventId === eventId && record.notificationsEnabled);
}
