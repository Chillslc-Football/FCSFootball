import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';
import type { DeviceRegistrationResult, NotificationPreferences } from '@/data/notifications/types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/data/notifications/types';
import { getOrCreateDeviceId } from '@/services/notifications/deviceIdentity';
import { registerForPushNotifications } from '@/services/notifications/notificationService';

function resolveAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

export async function registerDeviceWithBackend(
  options: { requestPermission?: boolean } = {},
): Promise<DeviceRegistrationResult | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const deviceUuid = await getOrCreateDeviceId();
  let expoPushToken: string | null = null;

  if (options.requestPermission !== false) {
    expoPushToken = await registerForPushNotifications();
  }

  const { data, error } = await supabase.rpc('register_device', {
    p_device_uuid: deviceUuid,
    p_expo_push_token: expoPushToken,
    p_platform: Platform.OS,
    p_app_version: resolveAppVersion(),
    p_notifications_enabled: Boolean(expoPushToken),
  });

  if (error) {
    console.warn('[deviceRegistration] register_device failed:', error.message);
    return { deviceId: deviceUuid, registered: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const deviceId = typeof row?.id === 'string' ? row.id : deviceUuid;
  return { deviceId, registered: true };
}

export async function updateDevicePushToken(expoPushToken: string | null): Promise<void> {
  if (!isSupabaseConfigured() || !expoPushToken) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const deviceUuid = await getOrCreateDeviceId();
  const { error } = await supabase.rpc('register_device', {
    p_device_uuid: deviceUuid,
    p_expo_push_token: expoPushToken,
    p_platform: Platform.OS,
    p_app_version: resolveAppVersion(),
    p_notifications_enabled: true,
  });

  if (error) {
    console.warn('[deviceRegistration] push token update failed:', error.message);
  }
}

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return DEFAULT_NOTIFICATION_PREFERENCES;

  const deviceUuid = await getOrCreateDeviceId();
  const { data, error } = await supabase.rpc('get_notification_preferences', {
    p_device_uuid: deviceUuid,
  });

  if (error || !data) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const record = row as Record<string, unknown>;
  return {
    favoriteGamesEnabled: record.favorite_games_enabled !== false,
    gameStartEnabled: record.game_start_enabled !== false,
    scoreEnabled: record.score_enabled !== false,
    quarterEndEnabled: record.quarter_end_enabled !== false,
    halftimeEnabled: record.halftime_enabled !== false,
    closeGameEnabled: record.close_game_enabled !== false,
    finalEnabled: record.final_enabled !== false,
  };
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const deviceUuid = await getOrCreateDeviceId();
  const { error } = await supabase.rpc('update_notification_preferences', {
    p_device_uuid: deviceUuid,
    p_favorite_games_enabled: preferences.favoriteGamesEnabled,
    p_game_start_enabled: preferences.gameStartEnabled,
    p_score_enabled: preferences.scoreEnabled,
    p_quarter_end_enabled: preferences.quarterEndEnabled,
    p_halftime_enabled: preferences.halftimeEnabled,
    p_close_game_enabled: preferences.closeGameEnabled,
    p_final_enabled: preferences.finalEnabled,
  });

  if (error) {
    console.warn('[deviceRegistration] update_notification_preferences failed:', error.message);
  }
}

export async function ensureNotificationReady(
  options: { requestPermission?: boolean } = {},
): Promise<{ permissionGranted: boolean; registered: boolean }> {
  const pushToken = options.requestPermission === false ? null : await registerForPushNotifications();
  const registration = await registerDeviceWithBackend({
    requestPermission: options.requestPermission,
  });

  return {
    permissionGranted: Boolean(pushToken),
    registered: Boolean(registration?.registered),
  };
}
