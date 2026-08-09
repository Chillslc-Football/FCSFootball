/**
 * Single-flight cold-start notification writer coordination.
 * NotificationBootstrap owns the write; Settings only waits then probes read-only.
 */

type StartupSyncRunner = () => Promise<void>;

let startupPromise: Promise<void> | null = null;

/** Bound for Settings waiting on Bootstrap — not a health fix by itself. */
export const NOTIFICATION_STARTUP_SYNC_WAIT_MS = 12_000;

/**
 * Begin the one cold-start sync. Concurrent callers share the same promise.
 * Failures are logged; the promise still settles so waiters can probe.
 */
export function runNotificationStartupSync(runner: StartupSyncRunner): Promise<void> {
  if (!startupPromise) {
    startupPromise = Promise.resolve()
      .then(runner)
      .then(() => undefined)
      .catch((error) => {
        console.warn('[notificationStartupSync] cold-start sync failed:', error);
      });
  }
  return startupPromise;
}

/** Wait for the Bootstrap cold-start sync (or resolve immediately if none started). */
export function waitForNotificationStartupSync(): Promise<void> {
  return startupPromise ?? Promise.resolve();
}

/** Test helper — clears single-flight state. */
export function resetNotificationStartupSyncForTests(): void {
  startupPromise = null;
}

/** Pure helper for tests — Settings cold-start health must not write. */
export function isColdStartHealthPathWriteFree(options: {
  calledRegisterDevice: boolean;
  calledSyncPushTokenIfPermitted: boolean;
}): boolean {
  return !options.calledRegisterDevice && !options.calledSyncPushTokenIfPermitted;
}
