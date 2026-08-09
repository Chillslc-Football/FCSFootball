import {
  isNotificationDeliveryReady,
  type NotificationDeliverySnapshot,
} from '@/data/notifications/notificationEffectiveState';
import type { NotificationPermissionStatus } from '@/data/notifications/types';

export type DeliveryRefreshMode = 'soft' | 'hard';

/** Bound for one post-setup confirmation after timeout/incomplete. */
export const POST_SETUP_DELIVERY_RECONCILE_MS = 5_000;

export type NotificationSetupSettleResult =
  | 'success'
  | 'permission_denied'
  | 'incomplete'
  | 'timeout'
  | 'error';

/**
 * Soft refresh (AppState / background) must not regress healthy → unhealthy
 * on a flaky token or registration probe. Hard refresh (Enable / Try Again /
 * initial hydrate) always applies.
 */
export function shouldApplyDeliveryRefresh(options: {
  previous: NotificationDeliverySnapshot;
  next: NotificationDeliverySnapshot;
  mode: DeliveryRefreshMode;
}): boolean {
  const { previous, next, mode } = options;
  if (mode === 'hard') return true;

  // Permission explicitly revoked — always surface.
  if (next.permissionStatus === 'denied') return true;

  const prevReady = isNotificationDeliveryReady(previous);
  const nextReady = isNotificationDeliveryReady(next);

  if (nextReady) return true;
  if (prevReady && !nextReady) return false;

  return true;
}

/**
 * After Enable / Try Again settles timeout/incomplete with permission still
 * granted, run one authoritative confirmation (late register_device success).
 */
export function shouldRunPostSetupDeliveryReconcile(options: {
  setupResult: NotificationSetupSettleResult;
  permissionStatus: NotificationPermissionStatus;
}): boolean {
  if (options.permissionStatus === 'denied') return false;
  if (options.permissionStatus !== 'granted') return false;
  return options.setupResult === 'timeout' || options.setupResult === 'incomplete';
}

/**
 * Prefer a confirmed healthy (or denied) snapshot over a stale timeout snapshot.
 * Never invent health — confirmation must prove deliveryReady.
 */
export function selectDeliverySnapshotAfterSetup(options: {
  setupSnapshot: NotificationDeliverySnapshot;
  confirmed: NotificationDeliverySnapshot | null;
}): NotificationDeliverySnapshot {
  const { setupSnapshot, confirmed } = options;
  if (!confirmed) return setupSnapshot;

  if (confirmed.permissionStatus === 'denied') {
    return confirmed;
  }

  if (isNotificationDeliveryReady(confirmed)) {
    return confirmed;
  }

  return setupSnapshot;
}

/**
 * One bounded post-settle reconcile. Uses injected sync (typically
 * syncPushTokenIfPermitted) so Settings can recover from late registration
 * success without hanging forever.
 */
export async function reconcileDeliveryAfterSetupSettle(options: {
  setupResult: NotificationSetupSettleResult;
  setupSnapshot: NotificationDeliverySnapshot;
  syncDelivery: () => Promise<NotificationDeliverySnapshot>;
  /** Returns null when the confirmation exceeds timeoutMs. */
  withTimeout: <T>(promise: Promise<T>, ms: number) => Promise<T | null>;
  timeoutMs?: number;
}): Promise<NotificationDeliverySnapshot> {
  const { setupResult, setupSnapshot, syncDelivery, withTimeout } = options;
  if (
    !shouldRunPostSetupDeliveryReconcile({
      setupResult,
      permissionStatus: setupSnapshot.permissionStatus,
    })
  ) {
    return setupSnapshot;
  }

  const timeoutMs = options.timeoutMs ?? POST_SETUP_DELIVERY_RECONCILE_MS;
  let confirmed: NotificationDeliverySnapshot | null = null;
  try {
    confirmed = await withTimeout(syncDelivery(), timeoutMs);
  } catch {
    confirmed = null;
  }

  return selectDeliverySnapshotAfterSetup({ setupSnapshot, confirmed });
}
