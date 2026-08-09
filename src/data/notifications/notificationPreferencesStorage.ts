import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeNotificationPreferences } from '@/data/notifications/notificationEffectiveState';
import type { NotificationPreferences } from '@/data/notifications/types';

const STORAGE_KEY = 'fcsfootball.notificationPreferences.v1';

export type NotificationPreferencesCacheSnapshot = {
  preferences: NotificationPreferences;
  updatedAt: number;
};

let memoryFallback: NotificationPreferencesCacheSnapshot | null = null;

function isPreferences(value: unknown): value is NotificationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.favoriteGamesEnabled === 'boolean' &&
    typeof record.gameStartEnabled === 'boolean' &&
    typeof record.scoreEnabled === 'boolean' &&
    typeof record.quarterEndEnabled === 'boolean' &&
    typeof record.halftimeEnabled === 'boolean' &&
    typeof record.closeGameEnabled === 'boolean' &&
    typeof record.finalEnabled === 'boolean'
  );
}

function isEnvelope(value: unknown): value is { preferences: unknown; updatedAt: unknown } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'preferences' in value);
}

function toSnapshot(
  preferences: NotificationPreferences,
  updatedAt: number,
): NotificationPreferencesCacheSnapshot {
  return {
    preferences: normalizeNotificationPreferences(preferences),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

/**
 * Load one complete local desired-preference snapshot.
 * Legacy bare preference JSON is migrated to an envelope with updatedAt = now
 * so existing cache is treated as authoritative over older remote rows.
 */
export async function loadLocalNotificationPreferencesSnapshot(): Promise<NotificationPreferencesCacheSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return memoryFallback ? { ...memoryFallback, preferences: { ...memoryFallback.preferences } } : null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (isEnvelope(parsed) && isPreferences(parsed.preferences)) {
      const updatedAt =
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : 0;
      const snapshot = toSnapshot(parsed.preferences, updatedAt);
      memoryFallback = snapshot;
      return { ...snapshot, preferences: { ...snapshot.preferences } };
    }

    // Legacy v1: bare preferences object.
    if (isPreferences(parsed)) {
      const snapshot = toSnapshot(parsed, Date.now());
      memoryFallback = snapshot;
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Memory already holds the migrated snapshot.
      }
      return { ...snapshot, preferences: { ...snapshot.preferences } };
    }

    return memoryFallback ? { ...memoryFallback, preferences: { ...memoryFallback.preferences } } : null;
  } catch {
    return memoryFallback ? { ...memoryFallback, preferences: { ...memoryFallback.preferences } } : null;
  }
}

/** @deprecated Prefer loadLocalNotificationPreferencesSnapshot. */
export async function loadCachedNotificationPreferences(): Promise<NotificationPreferences | null> {
  const snapshot = await loadLocalNotificationPreferencesSnapshot();
  return snapshot ? { ...snapshot.preferences } : null;
}

export async function cacheNotificationPreferences(
  preferences: NotificationPreferences,
  updatedAt: number = Date.now(),
): Promise<void> {
  const snapshot = toSnapshot(preferences, updatedAt);
  memoryFallback = snapshot;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // In-memory fallback already updated.
  }
}
