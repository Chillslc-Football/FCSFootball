import {
  isNotificationDeliveryReady,
  type NotificationDeliverySnapshot,
} from '@/data/notifications/notificationEffectiveState';

export type DeliveryRefreshMode = 'soft' | 'hard';

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
