import { Platform } from 'react-native';

import {
  assembleNotificationDiagnosticsProbes,
  type NotificationDiagnosticsProbeSnapshot,
} from '@/data/notifications/notificationDiagnosticsLogic';
import {
  getLastNotificationSetupDiagnostic,
  raceTimeout,
} from '@/data/notifications/notificationSetup';
import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';
import type { NotificationPermissionStatus } from '@/data/notifications/types';
import { getOrCreateDeviceId } from '@/services/notifications/deviceIdentity';
import {
  getLastPushTokenFailure,
  getNotificationPermissionStatus,
  hasExpoProjectIdConfigured,
  probeExpoPushTokenPresent,
} from '@/services/notifications/notificationService';

export type { NotificationDiagnosticsProbeSnapshot } from '@/data/notifications/notificationDiagnosticsLogic';

const PREFS_PROBE_MS = 3_000;

/** Injectable overrides for tests that run under React Native / device. */
export type NotificationDiagnosticsProbeDeps = {
  getPermissionStatus?: () => Promise<NotificationPermissionStatus>;
  getDeviceUuid?: () => Promise<string>;
  probePushTokenPresent?: () => Promise<boolean>;
  isSupabaseConfigured?: () => boolean;
  hasProjectIdConfigured?: () => boolean;
  fetchBackendPrefs?: (deviceUuid: string) => Promise<{ ok: boolean; hasData: boolean }>;
  getLastSetup?: () => ReturnType<typeof getLastNotificationSetupDiagnostic>;
  getLastPushTokenFailure?: () => ReturnType<typeof getLastPushTokenFailure>;
};

function resolvePlatform(): NotificationDiagnosticsProbeSnapshot['platform'] {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

async function defaultFetchBackendPrefs(
  deviceUuid: string,
): Promise<{ ok: boolean; hasData: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, hasData: false };

  const { data, error } = await raceTimeout(
    (async () =>
      supabase.rpc('get_notification_preferences', {
        p_device_uuid: deviceUuid,
      }))(),
    PREFS_PROBE_MS,
    'prefs probe timed out',
  );

  if (error) return { ok: false, hasData: false };
  return { ok: true, hasData: Boolean(data) };
}

/**
 * Independent bounded probes — read-only with respect to notification setup
 * and device registration. Never calls register_device / ensureNotificationReady
 * / recordNotificationSetupDiagnostic.
 */
export async function collectNotificationDiagnosticsProbes(
  deps: NotificationDiagnosticsProbeDeps = {},
): Promise<NotificationDiagnosticsProbeSnapshot> {
  return assembleNotificationDiagnosticsProbes({
    getPermissionStatus: deps.getPermissionStatus ?? getNotificationPermissionStatus,
    getDeviceUuid: deps.getDeviceUuid ?? getOrCreateDeviceId,
    probePushTokenPresent: deps.probePushTokenPresent ?? probeExpoPushTokenPresent,
    isSupabaseConfigured: deps.isSupabaseConfigured ?? isSupabaseConfigured,
    hasProjectIdConfigured: deps.hasProjectIdConfigured ?? hasExpoProjectIdConfigured,
    fetchBackendPrefs: deps.fetchBackendPrefs ?? defaultFetchBackendPrefs,
    getLastSetup: deps.getLastSetup ?? getLastNotificationSetupDiagnostic,
    getLastPushTokenFailure: deps.getLastPushTokenFailure ?? getLastPushTokenFailure,
    platform: resolvePlatform(),
    raceTimeout,
  });
}
