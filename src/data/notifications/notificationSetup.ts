import type { NotificationPermissionStatus } from '@/data/notifications/types';

/** Total wall-clock budget for an explicit Enable / Try Again attempt. */
export const NOTIFICATION_SETUP_TIMEOUT_MS = 8_000;

/** Per-step budgets (kept under the overall budget). */
export const NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS = 5_000;
export const NOTIFICATION_DEVICE_WRITE_TIMEOUT_MS = 6_000;

export type NotificationSetupPhase =
  | 'idle'
  | 'permission'
  | 'push_token'
  | 'register_device'
  | 'complete';

export type NotificationSetupResultKind =
  | 'success'
  | 'permission_denied'
  | 'incomplete'
  | 'timeout'
  | 'error';

export type NotificationSetupDiagnostic = {
  phase: NotificationSetupPhase;
  result: NotificationSetupResultKind;
  permissionStatus: NotificationPermissionStatus | 'unknown';
  deviceUuidPresent: boolean;
  hasPushToken: boolean;
  deviceRegistered: boolean;
  detail?: string;
  updatedAtMs: number;
};

export type NotificationSetupAttemptResult = {
  permissionGranted: boolean;
  permissionStatus: NotificationPermissionStatus;
  registered: boolean;
  hasPushToken: boolean;
  phase: NotificationSetupPhase;
  result: NotificationSetupResultKind;
  detail?: string;
};

const IDLE_DIAGNOSTIC: NotificationSetupDiagnostic = {
  phase: 'idle',
  result: 'incomplete',
  permissionStatus: 'unknown',
  deviceUuidPresent: false,
  hasPushToken: false,
  deviceRegistered: false,
  updatedAtMs: 0,
};

let lastSetupDiagnostic: NotificationSetupDiagnostic = IDLE_DIAGNOSTIC;

export function getLastNotificationSetupDiagnostic(): NotificationSetupDiagnostic {
  return lastSetupDiagnostic;
}

export function recordNotificationSetupDiagnostic(
  patch: Partial<NotificationSetupDiagnostic> &
    Pick<NotificationSetupDiagnostic, 'phase' | 'result'>,
): NotificationSetupDiagnostic {
  lastSetupDiagnostic = {
    ...lastSetupDiagnostic,
    ...patch,
    updatedAtMs: Date.now(),
  };
  return lastSetupDiagnostic;
}

/** Test helper — resets module diagnostic state. */
export function resetNotificationSetupDiagnosticForTests(): void {
  lastSetupDiagnostic = { ...IDLE_DIAGNOSTIC };
}

/**
 * Race a promise against a timeout. On timeout the original promise keeps running
 * but this race settles so callers (and registration queues) can proceed.
 */
export async function raceTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export type NotificationSetupDeps = {
  getPermissionStatus: () => Promise<NotificationPermissionStatus>;
  requestPermissionAndToken: () => Promise<string | null>;
  getExistingToken: () => Promise<string | null>;
  registerDevice: (expoPushToken: string | null) => Promise<{ registered: boolean } | null>;
  hasDeviceUuid?: () => Promise<boolean>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Bounded notification readiness attempt used by Enable / Try Again.
 * Always settles (success, incomplete, timeout, or error) — never hangs.
 */
export async function runNotificationSetupAttempt(
  options: {
    requestPermission?: boolean;
    timeoutMs?: number;
  },
  deps: NotificationSetupDeps,
): Promise<NotificationSetupAttemptResult> {
  const requestPermission = options.requestPermission !== false;
  const timeoutMs = options.timeoutMs ?? NOTIFICATION_SETUP_TIMEOUT_MS;
  const now = deps.now ?? Date.now;

  recordNotificationSetupDiagnostic({
    phase: 'permission',
    result: 'incomplete',
    permissionStatus: 'unknown',
    hasPushToken: false,
    deviceRegistered: false,
    detail: undefined,
  });

  try {
    return await raceTimeout(
      executeSetupAttempt({ requestPermission, deps, now }),
      timeoutMs,
      'Notification setup timed out',
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Notification setup failed';
    const timedOut = /timed out/i.test(detail);
    const snapshot = recordNotificationSetupDiagnostic({
      phase: lastSetupDiagnostic.phase === 'idle' ? 'permission' : lastSetupDiagnostic.phase,
      result: timedOut ? 'timeout' : 'error',
      detail,
    });
    return {
      permissionGranted: snapshot.permissionStatus === 'granted',
      permissionStatus:
        snapshot.permissionStatus === 'unknown' ? 'undetermined' : snapshot.permissionStatus,
      registered: snapshot.deviceRegistered,
      hasPushToken: snapshot.hasPushToken,
      phase: snapshot.phase,
      result: snapshot.result,
      detail,
    };
  }
}

async function executeSetupAttempt(options: {
  requestPermission: boolean;
  deps: NotificationSetupDeps;
  now: () => number;
}): Promise<NotificationSetupAttemptResult> {
  const { requestPermission, deps } = options;

  recordNotificationSetupDiagnostic({ phase: 'permission', result: 'incomplete' });
  const permissionStatus = await deps.getPermissionStatus();
  const deviceUuidPresent = deps.hasDeviceUuid ? await deps.hasDeviceUuid() : true;

  recordNotificationSetupDiagnostic({
    phase: 'permission',
    result: 'incomplete',
    permissionStatus,
    deviceUuidPresent,
  });

  if (!requestPermission && permissionStatus !== 'granted') {
    const result = recordNotificationSetupDiagnostic({
      phase: 'complete',
      result: permissionStatus === 'denied' ? 'permission_denied' : 'incomplete',
      permissionStatus,
      deviceUuidPresent,
      hasPushToken: false,
      deviceRegistered: false,
    });
    return toAttemptResult(result, permissionStatus);
  }

  if (permissionStatus === 'denied' && !requestPermission) {
    const result = recordNotificationSetupDiagnostic({
      phase: 'complete',
      result: 'permission_denied',
      permissionStatus,
      deviceUuidPresent,
      hasPushToken: false,
      deviceRegistered: false,
    });
    return toAttemptResult(result, permissionStatus);
  }

  recordNotificationSetupDiagnostic({
    phase: 'push_token',
    result: 'incomplete',
    permissionStatus,
    deviceUuidPresent,
  });

  let pushToken: string | null = null;
  try {
    pushToken = requestPermission
      ? await deps.requestPermissionAndToken()
      : await deps.getExistingToken();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Push token request failed';
    recordNotificationSetupDiagnostic({
      phase: 'push_token',
      result: /timed out/i.test(detail) ? 'timeout' : 'error',
      permissionStatus,
      deviceUuidPresent,
      hasPushToken: false,
      detail,
    });
    // Continue to register device without token when possible.
    pushToken = null;
  }

  const permissionAfterToken = await deps.getPermissionStatus().catch(() => permissionStatus);

  if (permissionAfterToken === 'denied' && !pushToken) {
    const result = recordNotificationSetupDiagnostic({
      phase: 'complete',
      result: 'permission_denied',
      permissionStatus: permissionAfterToken,
      deviceUuidPresent,
      hasPushToken: false,
      deviceRegistered: false,
    });
    return toAttemptResult(result, permissionAfterToken);
  }

  recordNotificationSetupDiagnostic({
    phase: 'register_device',
    result: 'incomplete',
    permissionStatus: permissionAfterToken,
    deviceUuidPresent,
    hasPushToken: Boolean(pushToken),
  });

  let registered = false;
  try {
    const registration = await deps.registerDevice(pushToken);
    registered = Boolean(registration?.registered);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Device registration failed';
    const result = recordNotificationSetupDiagnostic({
      phase: 'register_device',
      result: /timed out/i.test(detail) ? 'timeout' : 'error',
      permissionStatus: permissionAfterToken,
      deviceUuidPresent,
      hasPushToken: Boolean(pushToken),
      deviceRegistered: false,
      detail,
    });
    return toAttemptResult(result, permissionAfterToken);
  }

  const ready = permissionAfterToken === 'granted' && registered && Boolean(pushToken);
  const result = recordNotificationSetupDiagnostic({
    phase: 'complete',
    result: ready ? 'success' : 'incomplete',
    permissionStatus: permissionAfterToken,
    deviceUuidPresent,
    hasPushToken: Boolean(pushToken),
    deviceRegistered: registered,
    detail: ready
      ? undefined
      : !pushToken
        ? 'Push token missing'
        : !registered
          ? 'Device not registered'
          : 'Setup incomplete',
  });

  return toAttemptResult(result, permissionAfterToken);
}

function toAttemptResult(
  diagnostic: NotificationSetupDiagnostic,
  permissionStatus: NotificationPermissionStatus,
): NotificationSetupAttemptResult {
  return {
    permissionGranted: permissionStatus === 'granted',
    permissionStatus,
    registered: diagnostic.deviceRegistered,
    hasPushToken: diagnostic.hasPushToken,
    phase: diagnostic.phase,
    result: diagnostic.result,
    detail: diagnostic.detail,
  };
}

export function buildSetupDiagnosticLines(diagnostic: NotificationSetupDiagnostic): string[] {
  return [
    `Last setup phase: ${diagnostic.phase}`,
    `Last setup result: ${diagnostic.result}`,
    `Permission: ${diagnostic.permissionStatus}`,
    `Device UUID: ${diagnostic.deviceUuidPresent ? 'present' : 'missing'}`,
    `Push token: ${diagnostic.hasPushToken ? 'present' : 'missing'}`,
    `Backend device: ${diagnostic.deviceRegistered ? 'registered' : 'not registered'}`,
    ...(diagnostic.detail ? [`Last setup detail: ${diagnostic.detail}`] : []),
  ];
}
