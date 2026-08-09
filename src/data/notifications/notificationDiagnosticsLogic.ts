import type { NotificationSetupResultKind } from '@/data/notifications/notificationSetup';
import type { NotificationPermissionStatus } from '@/data/notifications/types';

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

export type NotificationDiagnosticsLogicDeps = {
  getPermissionStatus: () => Promise<NotificationPermissionStatus>;
  getDeviceUuid: () => Promise<string>;
  probePushTokenPresent: () => Promise<boolean>;
  isSupabaseConfigured: () => boolean;
  hasProjectIdConfigured: () => boolean;
  /** Read-only prefs lookup — callers must not implement this via register_device. */
  fetchBackendPrefs: (deviceUuid: string) => Promise<{ ok: boolean; hasData: boolean }>;
  getLastSetup: () => {
    phase: string;
    result: NotificationSetupResultKind | string;
    detail?: string;
  };
  getLastPushTokenFailure: () => {
    category: string;
    safeMessage: string;
  } | null;
  platform: NotificationDiagnosticsProbeSnapshot['platform'];
  permissionProbeMs?: number;
  uuidProbeMs?: number;
  tokenProbeMs?: number;
  raceTimeout: <T>(promise: Promise<T>, ms: number, timeoutMessage: string) => Promise<T>;
};

/**
 * Pure diagnostics assembly (no React Native). Read-only by contract:
 * never writes setup diagnostics and never registers devices.
 */
export async function assembleNotificationDiagnosticsProbes(
  deps: NotificationDiagnosticsLogicDeps,
): Promise<NotificationDiagnosticsProbeSnapshot> {
  const lastSetup = deps.getLastSetup();
  const supabaseConfigured = deps.isSupabaseConfigured();
  const projectIdConfigured = deps.hasProjectIdConfigured();
  const permissionProbeMs = deps.permissionProbeMs ?? 2_000;
  const uuidProbeMs = deps.uuidProbeMs ?? 2_000;
  const tokenProbeMs = deps.tokenProbeMs ?? 4_500;
  let lastFailedProbe: string | undefined;

  let permissionStatus: NotificationPermissionStatus = 'undetermined';
  try {
    permissionStatus = await deps.raceTimeout(
      deps.getPermissionStatus(),
      permissionProbeMs,
      'permission probe timed out',
    );
  } catch {
    lastFailedProbe = 'permission';
  }

  let deviceUuidPresent = false;
  let deviceUuid = '';
  try {
    const id = await deps.raceTimeout(
      deps.getDeviceUuid(),
      uuidProbeMs,
      'uuid probe timed out',
    );
    deviceUuid = id?.trim() ?? '';
    deviceUuidPresent = Boolean(deviceUuid);
  } catch {
    lastFailedProbe = lastFailedProbe ?? 'device_uuid';
  }

  let hasPushToken = false;
  let pushTokenFailureCategory: string | undefined;
  let pushTokenFailureDetail: string | undefined;
  if (permissionStatus === 'granted' && projectIdConfigured) {
    try {
      hasPushToken = await deps.raceTimeout(
        deps.probePushTokenPresent(),
        tokenProbeMs,
        'token probe timed out',
      );
      if (!hasPushToken) {
        const failure = deps.getLastPushTokenFailure();
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
  if (supabaseConfigured && deviceUuidPresent) {
    try {
      const prefs = await deps.fetchBackendPrefs(deviceUuid);
      deviceRegistered = prefs.ok && prefs.hasData;
      backendPrefsLoaded = prefs.ok && prefs.hasData;
      if (!backendPrefsLoaded) {
        lastFailedProbe = lastFailedProbe ?? 'backend_prefs';
      }
    } catch {
      lastFailedProbe = lastFailedProbe ?? 'backend_prefs';
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
    platform: deps.platform,
    lastFailedProbe,
    pushTokenFailureCategory,
    pushTokenFailureDetail,
    lastSetupPhase: lastSetup.phase,
    lastSetupResult: lastSetup.result,
    lastSetupDetail: lastSetup.detail,
  };
}
