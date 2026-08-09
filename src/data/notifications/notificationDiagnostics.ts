import { Platform } from 'react-native';

import {
  getLastNotificationSetupDiagnostic,
  raceTimeout,
  type NotificationSetupResultKind,
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

const PERMISSION_PROBE_MS = 2_000;
const UUID_PROBE_MS = 2_000;
const TOKEN_PROBE_MS = 4_500;
const REGISTER_PROBE_MS = 4_000;
const PREFS_PROBE_MS = 3_000;

export type NotificationDiagnosticsProbeSnapshot = {
  permissionStatus: NotificationPermissionStatus;
  deviceUuidPresent: boolean;
  hasPushToken: boolean;
  deviceRegistered: boolean;
  backendPrefsLoaded: boolean;
  supabaseConfigured: boolean;
  projectIdConfigured: boolean;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  lastFailedProbe?: string;
  pushTokenFailureCategory?: string;
  pushTokenFailureDetail?: string;
  lastSetupPhase: string;
  lastSetupResult: NotificationSetupResultKind | string;
  lastSetupDetail?: string;
};

function resolvePlatform(): NotificationDiagnosticsProbeSnapshot['platform'] {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

/**
 * Independent bounded probes — one hanging call must not erase local truth
 * (permission / Supabase config / projectId).
 */
export async function collectNotificationDiagnosticsProbes(): Promise<NotificationDiagnosticsProbeSnapshot> {
  const lastSetup = getLastNotificationSetupDiagnostic();
  const supabaseConfigured = isSupabaseConfigured();
  const projectIdConfigured = hasExpoProjectIdConfigured();
  let lastFailedProbe: string | undefined;

  let permissionStatus: NotificationPermissionStatus = 'undetermined';
  try {
    permissionStatus = await raceTimeout(
      getNotificationPermissionStatus(),
      PERMISSION_PROBE_MS,
      'permission probe timed out',
    );
  } catch {
    lastFailedProbe = 'permission';
  }

  let deviceUuidPresent = false;
  try {
    const id = await raceTimeout(getOrCreateDeviceId(), UUID_PROBE_MS, 'uuid probe timed out');
    deviceUuidPresent = Boolean(id?.trim());
  } catch {
    lastFailedProbe = lastFailedProbe ?? 'device_uuid';
  }

  let hasPushToken = false;
  let pushTokenFailureCategory: string | undefined;
  let pushTokenFailureDetail: string | undefined;
  if (permissionStatus === 'granted' && projectIdConfigured) {
    try {
      hasPushToken = await raceTimeout(
        probeExpoPushTokenPresent(),
        TOKEN_PROBE_MS,
        'token probe timed out',
      );
      if (!hasPushToken) {
        const failure = getLastPushTokenFailure();
        pushTokenFailureCategory = failure?.category ?? 'missing';
        pushTokenFailureDetail = failure?.safeMessage ?? 'Push token missing';
        lastFailedProbe = lastFailedProbe ?? 'push_token';
      }
    } catch (error) {
      lastFailedProbe = lastFailedProbe ?? 'push_token';
      pushTokenFailureCategory = 'timeout';
      pushTokenFailureDetail =
        error instanceof Error ? error.message : 'Push token probe timed out';
    }
  } else if (permissionStatus === 'granted' && !projectIdConfigured) {
    pushTokenFailureCategory = 'project_id';
    pushTokenFailureDetail = 'Expo projectId missing';
    lastFailedProbe = lastFailedProbe ?? 'project_id';
  }

  let deviceRegistered = false;
  let backendPrefsLoaded = false;
  if (supabaseConfigured) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      lastFailedProbe = lastFailedProbe ?? 'supabase_client';
    } else {
      try {
        const deviceUuid = await getOrCreateDeviceId();
        const { data, error } = await raceTimeout(
          (async () =>
            supabase.rpc('register_device', {
              p_device_uuid: deviceUuid,
              p_expo_push_token: null,
              p_platform: Platform.OS,
              p_app_version: 'diagnostics',
              p_notifications_enabled: false,
            }))(),
          REGISTER_PROBE_MS,
          'register_device probe timed out',
        );
        if (error) {
          lastFailedProbe = lastFailedProbe ?? 'register_device';
        } else {
          const row = Array.isArray(data) ? data[0] : data;
          deviceRegistered = Boolean(
            (row && typeof row === 'object' && ('id' in row || 'device_uuid' in row)) ||
              deviceUuid,
          );
        }
      } catch {
        lastFailedProbe = lastFailedProbe ?? 'register_device';
      }

      if (deviceRegistered) {
        try {
          const deviceUuid = await getOrCreateDeviceId();
          const { data, error } = await raceTimeout(
            (async () =>
              supabase.rpc('get_notification_preferences', {
                p_device_uuid: deviceUuid,
              }))(),
            PREFS_PROBE_MS,
            'prefs probe timed out',
          );
          backendPrefsLoaded = !error && Boolean(data);
          if (!backendPrefsLoaded) {
            lastFailedProbe = lastFailedProbe ?? 'backend_prefs';
          }
        } catch {
          lastFailedProbe = lastFailedProbe ?? 'backend_prefs';
        }
      }
    }
  }

  return {
    permissionStatus,
    deviceUuidPresent,
    hasPushToken,
    deviceRegistered,
    backendPrefsLoaded,
    supabaseConfigured,
    projectIdConfigured,
    platform: resolvePlatform(),
    lastFailedProbe,
    pushTokenFailureCategory,
    pushTokenFailureDetail,
    lastSetupPhase: lastSetup.phase,
    lastSetupResult: lastSetup.result,
    lastSetupDetail: lastSetup.detail,
  };
}
