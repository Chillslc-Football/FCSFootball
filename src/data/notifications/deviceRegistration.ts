import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  normalizeNotificationPreferences,
  parseNotificationPreferencesRecord,
  reconcileNotificationPreferencesSnapshot,
  type RemoteNotificationPreferences,
} from '@/data/notifications/notificationEffectiveState';
import {
  cacheNotificationPreferences,
  loadLocalNotificationPreferencesSnapshot,
  type NotificationPreferencesCacheSnapshot,
} from '@/data/notifications/notificationPreferencesStorage';
import {
  NOTIFICATION_DEVICE_WRITE_TIMEOUT_MS,
  raceTimeout,
  runNotificationSetupAttempt,
} from '@/data/notifications/notificationSetup';
import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';
import type { DeviceRegistrationResult, NotificationPreferences } from '@/data/notifications/types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/data/notifications/types';
import { getOrCreateDeviceId } from '@/services/notifications/deviceIdentity';
import {
  getExistingExpoPushToken,
  getNotificationPermissionStatus,
  registerForPushNotifications,
} from '@/services/notifications/notificationService';

/** Cap Settings/launch init so a hung RPC cannot spin the UI forever. */
const NOTIFICATION_INIT_TIMEOUT_MS = 5000;

function resolveAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((value) => value),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Serialize device RPC writes so launch + Settings init cannot interleave badly.
 * Each write is bounded — a hung prior attempt must not poison later Try Again taps.
 */
let registrationChain: Promise<unknown> = Promise.resolve();

function enqueueDeviceWrite<T>(fn: () => Promise<T>): Promise<T> {
  const bounded = () =>
    raceTimeout(fn(), NOTIFICATION_DEVICE_WRITE_TIMEOUT_MS, 'Device registration timed out');

  const next = registrationChain.then(bounded, bounded);
  registrationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Test helper — clears the serialized write chain. */
export function resetDeviceRegistrationQueueForTests(): void {
  registrationChain = Promise.resolve();
}

export type RegisterDeviceOptions = {
  /** When false, never prompt for OS permission. */
  requestPermission?: boolean;
  /** Optional pre-fetched Expo push token (avoids a second token fetch). */
  expoPushToken?: string | null;
};

export async function registerDeviceWithBackend(
  options: RegisterDeviceOptions = {},
): Promise<DeviceRegistrationResult | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return enqueueDeviceWrite(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const deviceUuid = await getOrCreateDeviceId();
    let expoPushToken: string | null;
    if (options.expoPushToken !== undefined) {
      expoPushToken = options.expoPushToken;
    } else if (options.requestPermission === false) {
      expoPushToken = await getExistingExpoPushToken();
    } else {
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
  });
}

export async function updateDevicePushToken(expoPushToken: string | null): Promise<void> {
  if (!isSupabaseConfigured() || !expoPushToken) return;

  await registerDeviceWithBackend({
    requestPermission: false,
    expoPushToken,
  });
}

/**
 * Attach an Expo push token when permission is already granted.
 * Safe for app launch — does not prompt.
 */
export async function syncPushTokenIfPermitted(): Promise<{
  permissionStatus: Awaited<ReturnType<typeof getNotificationPermissionStatus>>;
  deviceRegistered: boolean;
  hasPushToken: boolean;
}> {
  const permissionStatus = await getNotificationPermissionStatus();
  if (permissionStatus !== 'granted') {
    // Still create/refresh the device row so prefs RPCs can work — no permission prompt.
    const registration = await registerDeviceWithBackend({
      requestPermission: false,
      expoPushToken: null,
    });
    return {
      permissionStatus,
      deviceRegistered: Boolean(registration?.registered),
      hasPushToken: false,
    };
  }

  // Permission already granted — fetch token (with service-level retry) and attach to device.
  let expoPushToken = await getExistingExpoPushToken();
  if (!expoPushToken) {
    // Stronger path: registerForPushNotifications does not re-prompt when already granted.
    expoPushToken = await registerForPushNotifications();
  }

  const registration = await registerDeviceWithBackend({
    requestPermission: false,
    expoPushToken,
  });

  return {
    permissionStatus,
    deviceRegistered: Boolean(registration?.registered),
    hasPushToken: Boolean(expoPushToken),
  };
}

/** Snapshot used by Developer Notification Diagnostics (no secrets / no full token). */
export async function loadNotificationDiagnosticsSnapshot(): Promise<{
  permissionStatus: Awaited<ReturnType<typeof getNotificationPermissionStatus>>;
  deviceRegistered: boolean;
  hasPushToken: boolean;
  backendPrefsLoaded: boolean;
  supabaseConfigured: boolean;
}> {
  const supabaseConfigured = isSupabaseConfigured();
  const delivery = await syncPushTokenIfPermitted();
  let backendPrefsLoaded = false;
  if (delivery.deviceRegistered) {
    const remote = await fetchRemoteNotificationPreferences();
    backendPrefsLoaded = Boolean(remote);
  }

  return {
    ...delivery,
    backendPrefsLoaded,
    supabaseConfigured,
  };
}

/** One complete local snapshot for first paint (cache or schema defaults). */
export async function loadLocalDesiredPreferencesSnapshot(): Promise<NotificationPreferencesCacheSnapshot> {
  const cached = await loadLocalNotificationPreferencesSnapshot().catch(() => null);
  if (cached) {
    return {
      preferences: normalizeNotificationPreferences(cached.preferences),
      updatedAt: cached.updatedAt,
    };
  }
  return {
    preferences: normalizeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES),
    updatedAt: 0,
  };
}

/** Fetch remote prefs as one complete normalized object. Does not merge into cache. */
export async function fetchRemoteNotificationPreferences(): Promise<RemoteNotificationPreferences | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Preferences RPCs require a device row. Register without prompting.
  const registration = await registerDeviceWithBackend({ requestPermission: false });
  if (!registration?.registered) return null;

  const deviceUuid = await getOrCreateDeviceId();
  const { data, error } = await supabase.rpc('get_notification_preferences', {
    p_device_uuid: deviceUuid,
  });

  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  return parseNotificationPreferencesRecord(
    row && typeof row === 'object' ? (row as Record<string, unknown>) : null,
  );
}

/**
 * Reconcile local desired prefs with remote after first paint.
 * Never returns a field-by-field partial merge — always one complete object.
 */
export async function reconcileRemoteNotificationPreferences(
  local: NotificationPreferencesCacheSnapshot,
): Promise<{
  preferences: NotificationPreferences;
  updatedAt: number;
  source: 'local' | 'remote';
  delivery: {
    permissionStatus: Awaited<ReturnType<typeof getNotificationPermissionStatus>>;
    deviceRegistered: boolean;
    hasPushToken: boolean;
  };
}> {
  const delivery = await syncPushTokenIfPermitted();
  const remote = await fetchRemoteNotificationPreferences();

  const reconciled = reconcileNotificationPreferencesSnapshot({
    local: local.preferences,
    localUpdatedAt: local.updatedAt,
    remote: remote?.preferences ?? null,
    remoteUpdatedAt: remote?.updatedAtMs ?? 0,
  });

  const updatedAt =
    reconciled.source === 'remote' && remote
      ? remote.updatedAtMs
      : local.updatedAt;

  if (reconciled.source === 'remote') {
    await cacheNotificationPreferences(reconciled.preferences, updatedAt);
  }

  return {
    preferences: reconciled.preferences,
    updatedAt,
    source: reconciled.source,
    delivery,
  };
}

/** @deprecated Prefer loadLocalDesiredPreferencesSnapshot + reconcileRemoteNotificationPreferences. */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const local = await loadLocalDesiredPreferencesSnapshot();
  const remote = await fetchRemoteNotificationPreferences();
  const reconciled = reconcileNotificationPreferencesSnapshot({
    local: local.preferences,
    localUpdatedAt: local.updatedAt,
    remote: remote?.preferences ?? null,
    remoteUpdatedAt: remote?.updatedAtMs ?? 0,
  });
  if (reconciled.source === 'remote' && remote) {
    await cacheNotificationPreferences(reconciled.preferences, remote.updatedAtMs);
  }
  return reconciled.preferences;
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<void> {
  await cacheNotificationPreferences(preferences);

  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const registration = await registerDeviceWithBackend({ requestPermission: false });
  if (!registration?.registered) {
    console.warn('[deviceRegistration] update_notification_preferences skipped — device not registered');
    return;
  }

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
): Promise<{
  permissionGranted: boolean;
  registered: boolean;
  hasPushToken: boolean;
  permissionStatus: Awaited<ReturnType<typeof getNotificationPermissionStatus>>;
  result: 'success' | 'permission_denied' | 'incomplete' | 'timeout' | 'error';
  phase: string;
}> {
  const attempt = await runNotificationSetupAttempt(
    { requestPermission: options.requestPermission },
    {
      getPermissionStatus: getNotificationPermissionStatus,
      requestPermissionAndToken: registerForPushNotifications,
      getExistingToken: getExistingExpoPushToken,
      registerDevice: async (expoPushToken) =>
        registerDeviceWithBackend({
          requestPermission: false,
          expoPushToken,
        }),
      hasDeviceUuid: async () => {
        try {
          const id = await getOrCreateDeviceId();
          return Boolean(id?.trim());
        } catch {
          return false;
        }
      },
    },
  );

  return {
    permissionGranted: attempt.permissionGranted,
    registered: attempt.registered,
    hasPushToken: attempt.hasPushToken,
    permissionStatus: attempt.permissionStatus,
    result: attempt.result,
    phase: attempt.phase,
  };
}

export type NotificationInitState = {
  preferences: NotificationPreferences;
  permissionStatus: Awaited<ReturnType<typeof getNotificationPermissionStatus>>;
  deviceRegistered: boolean;
  hasPushToken: boolean;
};

/**
 * Settings / launch init: always settles with the local desired snapshot first.
 * Remote sync is best-effort and returned only when it completes within the timeout;
 * callers should apply remote via reconcileRemoteNotificationPreferences instead of
 * blocking first paint on network.
 * Does not prompt for notification permission.
 */
export async function initializeNotificationState(): Promise<NotificationInitState> {
  const local = await loadLocalDesiredPreferencesSnapshot();
  const permissionStatus = await getNotificationPermissionStatus().catch(
    (): Awaited<ReturnType<typeof getNotificationPermissionStatus>> => 'undetermined',
  );

  const remote = await withTimeout(
    reconcileRemoteNotificationPreferences(local),
    NOTIFICATION_INIT_TIMEOUT_MS,
  );

  if (!remote) {
    console.warn(
      '[deviceRegistration] initializeNotificationState timed out or failed remote sync — using local preferences',
    );
    return {
      preferences: local.preferences,
      permissionStatus,
      deviceRegistered: false,
      hasPushToken: false,
    };
  }

  return {
    preferences: remote.preferences,
    permissionStatus: remote.delivery.permissionStatus,
    deviceRegistered: remote.delivery.deviceRegistered,
    hasPushToken: remote.delivery.hasPushToken,
  };
}

export { NOTIFICATION_INIT_TIMEOUT_MS, withTimeout };
