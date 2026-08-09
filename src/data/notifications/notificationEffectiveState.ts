import type {
  NotificationPermissionStatus,
  NotificationPreferences,
} from '@/data/notifications/types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/data/notifications/types';

export type NotificationDeliverySnapshot = {
  permissionStatus: NotificationPermissionStatus;
  deviceRegistered: boolean;
  hasPushToken: boolean;
};

export type RemoteNotificationPreferences = {
  preferences: NotificationPreferences;
  updatedAtMs: number;
};

/** True only when OS permission, device row, and Expo push token are all ready. */
export function isNotificationDeliveryReady(
  snapshot: NotificationDeliverySnapshot,
): boolean {
  return (
    snapshot.permissionStatus === 'granted' &&
    snapshot.deviceRegistered &&
    snapshot.hasPushToken
  );
}

/** Preferences the UI should show as active right now. */
export function toEffectiveNotificationPreferences(
  preferences: NotificationPreferences,
  deliveryReady: boolean,
): NotificationPreferences {
  if (deliveryReady) {
    return preferences;
  }

  return {
    favoriteGamesEnabled: false,
    gameStartEnabled: false,
    scoreEnabled: false,
    quarterEndEnabled: false,
    halftimeEnabled: false,
    closeGameEnabled: false,
    finalEnabled: false,
  };
}

function readOptionalBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Always returns one complete preference object.
 * Missing/partial fields are filled from defaults intentionally — never left undefined.
 */
export function normalizeNotificationPreferences(
  partial: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  return {
    favoriteGamesEnabled:
      typeof partial?.favoriteGamesEnabled === 'boolean'
        ? partial.favoriteGamesEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.favoriteGamesEnabled,
    gameStartEnabled:
      typeof partial?.gameStartEnabled === 'boolean'
        ? partial.gameStartEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.gameStartEnabled,
    scoreEnabled:
      typeof partial?.scoreEnabled === 'boolean'
        ? partial.scoreEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.scoreEnabled,
    quarterEndEnabled:
      typeof partial?.quarterEndEnabled === 'boolean'
        ? partial.quarterEndEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.quarterEndEnabled,
    halftimeEnabled:
      typeof partial?.halftimeEnabled === 'boolean'
        ? partial.halftimeEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.halftimeEnabled,
    closeGameEnabled:
      typeof partial?.closeGameEnabled === 'boolean'
        ? partial.closeGameEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.closeGameEnabled,
    finalEnabled:
      typeof partial?.finalEnabled === 'boolean'
        ? partial.finalEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.finalEnabled,
  };
}

export function parseRemoteUpdatedAtMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

/**
 * Parse a Supabase notification_preferences row into one complete desired-preference snapshot.
 * Explicit booleans win; null/missing fields use schema defaults.
 */
export function parseNotificationPreferencesRecord(
  record: Record<string, unknown> | null | undefined,
): RemoteNotificationPreferences | null {
  if (!record || typeof record !== 'object') return null;

  return {
    preferences: normalizeNotificationPreferences({
      favoriteGamesEnabled: readOptionalBool(record.favorite_games_enabled),
      gameStartEnabled: readOptionalBool(record.game_start_enabled),
      scoreEnabled: readOptionalBool(record.score_enabled),
      quarterEndEnabled: readOptionalBool(record.quarter_end_enabled),
      halftimeEnabled: readOptionalBool(record.halftime_enabled),
      closeGameEnabled: readOptionalBool(record.close_game_enabled),
      finalEnabled: readOptionalBool(record.final_enabled),
    }),
    updatedAtMs: parseRemoteUpdatedAtMs(record.updated_at),
  };
}

/** Complete defaults when neither remote nor cache exist. */
export function coalesceNotificationPreferences(
  remote: NotificationPreferences | null,
  cached: NotificationPreferences | null,
): NotificationPreferences {
  return normalizeNotificationPreferences(remote ?? cached ?? DEFAULT_NOTIFICATION_PREFERENCES);
}

/**
 * Choose one authoritative complete snapshot.
 * - No remote → local (defaults or cache)
 * - No local save yet (updatedAt <= 0) → remote
 * - Remote strictly newer → remote
 * - Otherwise keep local (protects recent in-app toggles)
 */
export function reconcileNotificationPreferencesSnapshot(options: {
  local: NotificationPreferences;
  localUpdatedAt: number;
  remote: NotificationPreferences | null;
  remoteUpdatedAt: number;
}): { preferences: NotificationPreferences; source: 'local' | 'remote' } {
  const local = normalizeNotificationPreferences(options.local);

  if (!options.remote) {
    return { preferences: local, source: 'local' };
  }

  const remote = normalizeNotificationPreferences(options.remote);

  if (options.localUpdatedAt <= 0) {
    return { preferences: remote, source: 'remote' };
  }

  if (options.remoteUpdatedAt > options.localUpdatedAt) {
    return { preferences: remote, source: 'remote' };
  }

  return { preferences: local, source: 'local' };
}
