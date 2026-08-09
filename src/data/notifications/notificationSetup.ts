import { evaluateNotificationSetupSuccess } from '@/data/notifications/notificationSetupSuccess';
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
  requestPermissionAndToken: (budget: {
    deadlineMs: number;
    startedAtMs: number;
  }) => Promise<string | null>;
  getExistingToken: (budget: {
    deadlineMs: number;
    startedAtMs: number;
  }) => Promise<string | null>;
  registerDevice: (expoPushToken: string | null) => Promise<{ registered: boolean } | null>;
  hasDeviceUuid?: () => Promise<boolean>;
  isSupabaseConfigured?: () => boolean;
  hasProjectIdConfigured?: () => boolean;
  isExpoGo?: () => boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Bounded notification readiness attempt used by Enable / Try Again.
 * Always settles (success, incomplete, timeout, or error) — never hangs.
 * One true overall deadline — inner steps must not stack past timeoutMs.
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
  const startedAtMs = now();
  const deadlineMs = startedAtMs + timeoutMs;

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
      executeSetupAttempt({ requestPermission, deps, now, startedAtMs, deadlineMs }),
      timeoutMs,
      'Notification setup timed out',
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Notification setup failed';
    const timedOut = /timed out/i.test(detail);
    const snapshot = recordNotificationSetupDiagnostic({
      phase: lastSetupDiagnostic.phase === 'idle' ? 'permission' : lastSetupDiagnostic.phase,
      // Never preserve a prior success across a timed-out / failed attempt.
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
  startedAtMs: number;
  deadlineMs: number;
}): Promise<NotificationSetupAttemptResult> {
  const { requestPermission, deps, now, startedAtMs, deadlineMs } = options;
  const remainingMs = () => Math.max(0, deadlineMs - now());

  recordNotificationSetupDiagnostic({ phase: 'permission', result: 'incomplete' });
  const permissionStatus = await deps.getPermissionStatus();
  const deviceUuidPresent = deps.hasDeviceUuid ? await deps.hasDeviceUuid() : true;
  const supabaseConfigured = deps.isSupabaseConfigured?.() ?? true;
  const projectIdConfigured = deps.hasProjectIdConfigured?.() ?? true;
  const isExpoGo = deps.isExpoGo?.() ?? false;

  recordNotificationSetupDiagnostic({
    phase: 'permission',
    result: 'incomplete',
    permissionStatus,
    deviceUuidPresent,
  });

  if (!requestPermission && permissionStatus !== 'granted') {
    return finalizeAttempt({
      permissionStatus,
      deviceUuidPresent,
      hasPushToken: false,
      deviceRegistered: false,
      supabaseConfigured,
      projectIdConfigured,
      isExpoGo,
    });
  }

  if (permissionStatus === 'denied' && !requestPermission) {
    return finalizeAttempt({
      permissionStatus,
      deviceUuidPresent,
      hasPushToken: false,
      deviceRegistered: false,
      supabaseConfigured,
      projectIdConfigured,
      isExpoGo,
    });
  }

  recordNotificationSetupDiagnostic({
    phase: 'push_token',
    result: 'incomplete',
    permissionStatus,
    deviceUuidPresent,
  });

  let pushToken: string | null = null;
  if (remainingMs() < 200) {
    return finalizeAttempt({
      permissionStatus,
      deviceUuidPresent,
      hasPushToken: false,
      deviceRegistered: false,
      supabaseConfigured,
      projectIdConfigured,
      isExpoGo,
      forceResult: 'timeout',
      detail: 'Notification setup timed out',
    });
  }

  try {
    const budget = { deadlineMs, startedAtMs };
    pushToken = requestPermission
      ? await deps.requestPermissionAndToken(budget)
      : await deps.getExistingToken(budget);
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
    pushToken = null;
  }

  const permissionAfterToken = await deps.getPermissionStatus().catch(() => permissionStatus);

  if (permissionAfterToken === 'denied' && !pushToken) {
    return finalizeAttempt({
      permissionStatus: permissionAfterToken,
      deviceUuidPresent,
      hasPushToken: false,
      deviceRegistered: false,
      supabaseConfigured,
      projectIdConfigured,
      isExpoGo,
    });
  }

  recordNotificationSetupDiagnostic({
    phase: 'register_device',
    result: 'incomplete',
    permissionStatus: permissionAfterToken,
    deviceUuidPresent,
    hasPushToken: Boolean(pushToken),
  });

  let registered = false;
  if (remainingMs() < 200) {
    return finalizeAttempt({
      permissionStatus: permissionAfterToken,
      deviceUuidPresent,
      hasPushToken: Boolean(pushToken),
      deviceRegistered: false,
      supabaseConfigured,
      projectIdConfigured,
      isExpoGo,
      forceResult: 'timeout',
      detail: 'Notification setup timed out',
    });
  }

  try {
    const registration = await raceTimeout(
      deps.registerDevice(pushToken),
      Math.min(NOTIFICATION_DEVICE_WRITE_TIMEOUT_MS, remainingMs()),
      'Device registration timed out',
    );
    registered = Boolean(registration?.registered);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Device registration failed';
    return finalizeAttempt({
      permissionStatus: permissionAfterToken,
      deviceUuidPresent,
      hasPushToken: Boolean(pushToken),
      deviceRegistered: false,
      supabaseConfigured,
      projectIdConfigured,
      isExpoGo,
      forceResult: /timed out/i.test(detail) ? 'timeout' : 'error',
      detail,
    });
  }

  return finalizeAttempt({
    permissionStatus: permissionAfterToken,
    deviceUuidPresent,
    hasPushToken: Boolean(pushToken),
    deviceRegistered: registered,
    supabaseConfigured,
    projectIdConfigured,
    isExpoGo,
  });
}

function finalizeAttempt(input: {
  permissionStatus: NotificationPermissionStatus;
  deviceUuidPresent: boolean;
  hasPushToken: boolean;
  deviceRegistered: boolean;
  supabaseConfigured: boolean;
  projectIdConfigured: boolean;
  isExpoGo: boolean;
  forceResult?: NotificationSetupResultKind;
  detail?: string;
}): NotificationSetupAttemptResult {
  const evaluation = evaluateNotificationSetupSuccess({
    permissionStatus: input.permissionStatus,
    deviceUuidPresent: input.deviceUuidPresent,
    hasPushToken: input.hasPushToken,
    deviceRegistered: input.deviceRegistered,
    supabaseConfigured: input.supabaseConfigured,
    projectIdConfigured: input.projectIdConfigured,
    isExpoGo: input.isExpoGo,
  });

  let result: NotificationSetupResultKind = evaluation.result;
  let detail = input.detail ?? evaluation.detail;

  if (input.forceResult) {
    // Forced timeout/error never becomes success — even if fields look ready.
    result = input.forceResult === 'success' ? evaluation.result : input.forceResult;
    if (result === 'success' && !evaluation.deliveryReady) {
      result = 'incomplete';
      detail = evaluation.detail ?? 'Delivery not ready';
    }
  }

  // Absolute contract: success requires deliveryReady.
  if (result === 'success' && !evaluation.deliveryReady) {
    result = 'incomplete';
    detail = evaluation.detail ?? 'Delivery not ready';
  }

  const diagnostic = recordNotificationSetupDiagnostic({
    phase: 'complete',
    result,
    permissionStatus: input.permissionStatus,
    deviceUuidPresent: input.deviceUuidPresent,
    hasPushToken: input.hasPushToken,
    deviceRegistered: input.deviceRegistered,
    detail,
  });

  return {
    permissionGranted: input.permissionStatus === 'granted',
    permissionStatus: input.permissionStatus,
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
