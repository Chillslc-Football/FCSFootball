import type { NotificationDeliverySnapshot } from '@/data/notifications/notificationEffectiveState';
import { isNotificationDeliveryReady } from '@/data/notifications/notificationEffectiveState';
import type { NotificationPermissionStatus } from '@/data/notifications/types';

/** User-facing Settings status — never expose "Delivery Inactive". */
export type NotificationUserStatus =
  | 'healthy'
  | 'permission_denied'
  | 'permission_undetermined'
  | 'needs_attention';

export type NotificationUserStatusView = {
  status: NotificationUserStatus;
  title: string;
  supportingCopy: string;
  primaryAction: 'none' | 'enable' | 'open_settings' | 'retry';
};

export type NotificationDiagnosticsSnapshot = NotificationDeliverySnapshot & {
  backendPrefsLoaded: boolean;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  appEnvironment: 'expo_go' | 'installed_build';
  supabaseConfigured: boolean;
  projectIdConfigured?: boolean;
  lastSetupPhase?: string;
  lastSetupResult?: string;
  lastSetupDetail?: string;
  deviceUuidPresent?: boolean;
  lastFailedProbe?: string;
  pushTokenFailureCategory?: string;
  pushTokenFailureDetail?: string;
};

/**
 * Map technical readiness to a simple Settings state.
 * Desired preference switches remain independent of this status.
 */
export function resolveNotificationUserStatus(
  snapshot: NotificationDeliverySnapshot,
): NotificationUserStatus {
  if (snapshot.permissionStatus === 'denied') {
    return 'permission_denied';
  }
  if (snapshot.permissionStatus === 'undetermined') {
    return 'permission_undetermined';
  }
  // permission granted — delivery needs device row + Expo push token
  if (isNotificationDeliveryReady(snapshot)) {
    return 'healthy';
  }
  return 'needs_attention';
}

export function getNotificationUserStatusView(
  status: NotificationUserStatus,
): NotificationUserStatusView {
  switch (status) {
    case 'healthy':
      return {
        status,
        title: 'Notifications enabled',
        supportingCopy:
          'Favorite teams are followed automatically. You can also tap the bell on any game to follow that matchup.',
        primaryAction: 'none',
      };
    case 'permission_denied':
      return {
        status,
        title: 'Notifications are off',
        supportingCopy:
          'Enable notifications in your phone settings to receive game alerts.',
        primaryAction: 'open_settings',
      };
    case 'permission_undetermined':
      return {
        status,
        title: 'Notifications are off',
        supportingCopy:
          'Enable notifications to receive game alerts for favorite teams and followed games.',
        primaryAction: 'enable',
      };
    case 'needs_attention':
      return {
        status,
        title: 'Notifications need attention',
        supportingCopy:
          "We couldn't finish setting up notifications. Try again in a moment.",
        primaryAction: 'retry',
      };
  }
}

/** Production remote push is not reliable in Expo Go even if local OS permission is granted. */
export function isProductionPushCapable(appEnvironment: 'expo_go' | 'installed_build'): boolean {
  return appEnvironment === 'installed_build';
}

export function buildNotificationDiagnosticsLines(
  snapshot: NotificationDiagnosticsSnapshot,
): string[] {
  const deliveryReady = isNotificationDeliveryReady(snapshot);
  const productionCapable =
    isProductionPushCapable(snapshot.appEnvironment) && deliveryReady;

  return [
    `Permission: ${formatPermission(snapshot.permissionStatus)}`,
    `Device UUID: ${snapshot.deviceUuidPresent === false ? 'missing' : 'present'}`,
    `Device registered: ${snapshot.deviceRegistered ? 'yes' : 'no'}`,
    `Push token present: ${snapshot.hasPushToken ? 'yes' : 'no'}`,
    `Backend prefs loaded: ${snapshot.backendPrefsLoaded ? 'yes' : 'no'}`,
    `Delivery ready: ${deliveryReady ? 'yes' : 'no'}`,
    `Production push capable: ${productionCapable ? 'yes' : 'no'}`,
    `Platform: ${snapshot.platform}`,
    `App environment: ${snapshot.appEnvironment === 'expo_go' ? 'Expo Go' : 'installed build'}`,
    `Supabase configured: ${snapshot.supabaseConfigured ? 'yes' : 'no'}`,
    `Expo projectId configured: ${
      snapshot.projectIdConfigured === undefined
        ? 'n/a'
        : snapshot.projectIdConfigured
          ? 'yes'
          : 'no'
    }`,
    `Last setup phase: ${snapshot.lastSetupPhase ?? 'idle'}`,
    `Last setup result: ${snapshot.lastSetupResult ?? 'n/a'}`,
    ...(snapshot.lastSetupDetail
      ? [`Last setup detail: ${snapshot.lastSetupDetail}`]
      : []),
    ...(snapshot.lastFailedProbe
      ? [`Last diagnostic failed probe: ${snapshot.lastFailedProbe}`]
      : []),
    ...(snapshot.pushTokenFailureCategory
      ? [`Push token failure: ${snapshot.pushTokenFailureCategory}`]
      : []),
    ...(snapshot.pushTokenFailureDetail
      ? [`Push token detail: ${snapshot.pushTokenFailureDetail}`]
      : []),
  ];
}

function formatPermission(status: NotificationPermissionStatus): string {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    default:
      return 'undetermined';
  }
}
