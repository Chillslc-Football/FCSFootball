import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FollowedGameRecord } from '@/data/notifications/types';

const STORAGE_KEY = 'fcsfootball.followedGames.v1';

let memoryFallback: FollowedGameRecord[] = [];

function normalizeRecord(value: unknown): FollowedGameRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const eventId = typeof record.eventId === 'string' ? record.eventId.trim() : '';
  const awayTeamName = typeof record.awayTeamName === 'string' ? record.awayTeamName.trim() : '';
  const homeTeamName = typeof record.homeTeamName === 'string' ? record.homeTeamName.trim() : '';
  const kickoffAt = typeof record.kickoffAt === 'string' ? record.kickoffAt : '';

  if (!eventId || !awayTeamName || !homeTeamName) return null;

  return {
    eventId,
    awayTeamId: typeof record.awayTeamId === 'string' ? record.awayTeamId : undefined,
    homeTeamId: typeof record.homeTeamId === 'string' ? record.homeTeamId : undefined,
    awayTeamName,
    homeTeamName,
    kickoffAt,
    notificationsEnabled: record.notificationsEnabled !== false,
    expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : undefined,
  };
}

export async function loadFollowedGamesLocal(): Promise<FollowedGameRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...memoryFallback];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...memoryFallback];

    const records = parsed
      .map(normalizeRecord)
      .filter((record): record is FollowedGameRecord => record != null);

    memoryFallback = records;
    return records;
  } catch {
    return [...memoryFallback];
  }
}

export async function saveFollowedGamesLocal(records: FollowedGameRecord[]): Promise<void> {
  memoryFallback = records;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // In-memory fallback already updated.
  }
}

export async function isGameFollowedLocally(eventId: string): Promise<boolean> {
  const records = await loadFollowedGamesLocal();
  return records.some((record) => record.eventId === eventId && record.notificationsEnabled);
}

export async function upsertFollowedGameLocal(record: FollowedGameRecord): Promise<FollowedGameRecord[]> {
  const records = await loadFollowedGamesLocal();
  const next = records.filter((item) => item.eventId !== record.eventId);
  next.push(record);
  await saveFollowedGamesLocal(next);
  return next;
}

export async function removeFollowedGameLocal(eventId: string): Promise<FollowedGameRecord[]> {
  const records = await loadFollowedGamesLocal();
  const next = records.filter((item) => item.eventId !== eventId);
  await saveFollowedGamesLocal(next);
  return next;
}

export function pruneExpiredFollowedGames(
  records: FollowedGameRecord[],
  now = Date.now(),
): FollowedGameRecord[] {
  return records.filter((record) => {
    if (!record.expiresAt) return true;
    const expiresAt = Date.parse(record.expiresAt);
    return Number.isNaN(expiresAt) || expiresAt > now;
  });
}
