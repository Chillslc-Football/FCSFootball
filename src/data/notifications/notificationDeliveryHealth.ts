import { collectNotificationDiagnosticsProbes } from '@/data/notifications/notificationDiagnostics';
import type { NotificationDeliverySnapshot } from '@/data/notifications/notificationEffectiveState';
export type NotificationDeliveryHealth = NotificationDeliverySnapshot;

/**
 * Read-only delivery health for Settings cold start / soft refresh.
 * Reuses Diagnostics probes — never calls register_device or setup writes.
 */
export async function probeNotificationDeliveryHealth(): Promise<NotificationDeliveryHealth> {
  const probes = await collectNotificationDiagnosticsProbes();
  return {
    permissionStatus: probes.permissionStatus,
    deviceRegistered: probes.deviceRegistered,
    hasPushToken: probes.hasPushToken,
  };
}
