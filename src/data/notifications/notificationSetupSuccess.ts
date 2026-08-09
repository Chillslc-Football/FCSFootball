import { isNotificationDeliveryReady } from '@/data/notifications/notificationEffectiveState';
import type { NotificationSetupResultKind } from '@/data/notifications/notificationSetup';
import type { NotificationPermissionStatus } from '@/data/notifications/types';

export type NotificationSetupSuccessInput = {
  permissionStatus: NotificationPermissionStatus;
  deviceUuidPresent: boolean;
  hasPushToken: boolean;
  deviceRegistered: boolean;
  supabaseConfigured: boolean;
  projectIdConfigured: boolean;
  /** Expo Go cannot be production-delivery success. */
  isExpoGo?: boolean;
};

export type NotificationSetupSuccessEvaluation = {
  result: NotificationSetupResultKind;
  detail?: string;
  deliveryReady: boolean;
};

/**
 * Strict installed-build success contract.
 * success ⇒ deliveryReady and required infrastructure present.
 *
 * Backend prefs load is intentionally NOT required for success: prefs are a
 * diagnostics/hydration signal; deliveryReady already covers permission +
 * token + device registration for push delivery.
 */
export function evaluateNotificationSetupSuccess(
  input: NotificationSetupSuccessInput,
): NotificationSetupSuccessEvaluation {
  const deliveryReady = isNotificationDeliveryReady({
    permissionStatus: input.permissionStatus,
    deviceRegistered: input.deviceRegistered,
    hasPushToken: input.hasPushToken,
  });

  if (input.isExpoGo) {
    return {
      result: 'incomplete',
      detail: 'Expo Go is not production-push capable',
      deliveryReady: false,
    };
  }

  if (input.permissionStatus === 'denied') {
    return { result: 'permission_denied', deliveryReady: false };
  }

  if (input.permissionStatus === 'undetermined') {
    return {
      result: 'incomplete',
      detail: 'Permission not granted',
      deliveryReady: false,
    };
  }

  if (!input.deviceUuidPresent) {
    return {
      result: 'incomplete',
      detail: 'Device UUID missing',
      deliveryReady: false,
    };
  }

  if (!input.projectIdConfigured) {
    return {
      result: 'incomplete',
      detail: 'Expo projectId missing',
      deliveryReady: false,
    };
  }

  if (!input.supabaseConfigured) {
    return {
      result: 'incomplete',
      detail: 'Supabase not configured',
      deliveryReady: false,
    };
  }

  if (!input.hasPushToken) {
    return {
      result: 'incomplete',
      detail: 'Push token missing',
      deliveryReady: false,
    };
  }

  if (!input.deviceRegistered) {
    return {
      result: 'incomplete',
      detail: 'Device not registered',
      deliveryReady: false,
    };
  }

  if (!deliveryReady) {
    return {
      result: 'incomplete',
      detail: 'Delivery not ready',
      deliveryReady: false,
    };
  }

  return { result: 'success', deliveryReady: true };
}
