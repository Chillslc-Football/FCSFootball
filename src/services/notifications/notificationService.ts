import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS,
  raceTimeout,
} from '@/data/notifications/notificationSetup';
import {
  categorizePushTokenError,
  sanitizePushTokenErrorMessage,
  type PushTokenFailure,
} from '@/data/notifications/pushTokenErrors';
import type { NotificationPermissionStatus } from '@/data/notifications/types';

export const GAME_ALERTS_CHANNEL_ID = 'game-alerts';

export type { PushTokenFailure, PushTokenFailureCategory } from '@/data/notifications/pushTokenErrors';
export { categorizePushTokenError, sanitizePushTokenErrorMessage } from '@/data/notifications/pushTokenErrors';

let handlerConfigured = false;
let lastPushTokenFailure: PushTokenFailure | null = null;

export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(GAME_ALERTS_CHANNEL_ID, {
    name: 'Game Alerts',
    description: 'Live updates for favorite and followed FCS/FBS games',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#D4AF37',
  });
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  if (settings.canAskAgain === false) return 'denied';
  return 'undetermined';
}

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (!Device.isDevice) {
    return 'denied';
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return 'granted';
  }

  // Respect prior denial — do not re-prompt when the OS will not ask again.
  if (current.canAskAgain === false) {
    return 'denied';
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  if (requested.granted) return 'granted';
  if (requested.canAskAgain === false) return 'denied';
  return 'denied';
}

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

const EXPO_PUSH_TOKEN_RETRY_DELAY_MS = 750;

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function recordPushTokenFailure(failure: Omit<PushTokenFailure, 'updatedAtMs'>): void {
  lastPushTokenFailure = { ...failure, updatedAtMs: Date.now() };
}

export function getLastPushTokenFailure(): PushTokenFailure | null {
  return lastPushTokenFailure;
}

/** Test helper — clears last token failure. */
export function resetLastPushTokenFailureForTests(): void {
  lastPushTokenFailure = null;
}

async function fetchExpoPushTokenOnce(timeoutMs: number): Promise<string | null> {
  if (!Device.isDevice) {
    recordPushTokenFailure({
      category: 'not_device',
      safeMessage: 'Push notifications require a physical device',
    });
    console.warn('[notificationService] Push notifications require a physical device.');
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    recordPushTokenFailure({
      category: 'project_id',
      safeMessage: 'Expo projectId missing — cannot register push token',
    });
    console.warn(
      '[notificationService] Expo projectId is missing — cannot register push token.',
    );
    return null;
  }

  try {
    const token = await raceTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      timeoutMs,
      'Expo push token request timed out',
    );
    const value = typeof token?.data === 'string' ? token.data.trim() : '';
    if (!value) {
      recordPushTokenFailure({
        category: 'missing',
        safeMessage: 'Expo push token response was empty',
      });
      return null;
    }
    lastPushTokenFailure = null;
    return value;
  } catch (error) {
    const categorized = categorizePushTokenError(error);
    recordPushTokenFailure(categorized);
    console.warn('[notificationService] Failed to register Expo push token:', categorized.safeMessage);
    return null;
  }
}

/**
 * Fetch Expo push token with at most one short retry, respecting an overall deadline.
 * Never stacks waits beyond deadlineMs from `startedAtMs`.
 */
async function fetchExpoPushToken(options?: {
  deadlineMs?: number;
  startedAtMs?: number;
  now?: () => number;
}): Promise<string | null> {
  const now = options?.now ?? Date.now;
  const startedAtMs = options?.startedAtMs ?? now();
  const deadlineMs = options?.deadlineMs ?? startedAtMs + NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS;

  const remaining = () => Math.max(0, deadlineMs - now());
  const firstBudget = Math.min(NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS, remaining());
  if (firstBudget < 200) {
    recordPushTokenFailure({
      category: 'timeout',
      safeMessage: 'Expo push token request timed out',
    });
    return null;
  }

  const first = await fetchExpoPushTokenOnce(firstBudget);
  if (first) return first;

  const afterFirst = remaining();
  if (afterFirst < EXPO_PUSH_TOKEN_RETRY_DELAY_MS + 200) {
    return null;
  }

  await sleep(EXPO_PUSH_TOKEN_RETRY_DELAY_MS);
  const retryBudget = Math.min(NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS, remaining());
  if (retryBudget < 200) return null;
  return fetchExpoPushTokenOnce(retryBudget);
}

export function hasExpoProjectIdConfigured(): boolean {
  return Boolean(resolveExpoProjectId());
}

/**
 * Returns an Expo push token only when OS permission is already granted.
 * Does not prompt the user.
 */
export async function getExistingExpoPushToken(options?: {
  deadlineMs?: number;
  startedAtMs?: number;
}): Promise<string | null> {
  const permission = await getNotificationPermissionStatus();
  if (permission !== 'granted') {
    recordPushTokenFailure({
      category: 'permission',
      safeMessage: 'Notification permission not granted for token',
    });
    return null;
  }

  configureNotificationHandler();
  await setupAndroidNotificationChannel();
  return fetchExpoPushToken(options);
}

/**
 * Bounded presence check for diagnostics — one attempt, no stacked retry.
 * Does not prompt. Never returns the token value.
 */
export async function probeExpoPushTokenPresent(): Promise<boolean> {
  const permission = await getNotificationPermissionStatus();
  if (permission !== 'granted') return false;
  if (!hasExpoProjectIdConfigured()) {
    recordPushTokenFailure({
      category: 'project_id',
      safeMessage: 'Expo projectId missing — cannot register push token',
    });
    return false;
  }

  configureNotificationHandler();
  await setupAndroidNotificationChannel();
  const token = await fetchExpoPushTokenOnce(
    Math.min(NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS, 4_000),
  );
  return Boolean(token);
}

export async function registerForPushNotifications(options?: {
  deadlineMs?: number;
  startedAtMs?: number;
}): Promise<string | null> {
  configureNotificationHandler();
  await setupAndroidNotificationChannel();

  const permission = await requestNotificationPermissions();
  if (permission !== 'granted') {
    recordPushTokenFailure({
      category: 'permission',
      safeMessage: 'Notification permission not granted for token',
    });
    return null;
  }

  return fetchExpoPushToken(options);
}

export function addNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export function addPushTokenListener(
  listener: (token: Notifications.DevicePushToken) => void,
): Notifications.EventSubscription {
  return Notifications.addPushTokenListener(listener);
}

export async function scheduleLocalTestNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  configureNotificationHandler();
  await setupAndroidNotificationChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { ...data, test: true },
      sound: true,
    },
    trigger: null,
  });
}

export type ExpoSelfPushResult = {
  ok: boolean;
  error?: string;
};

/**
 * Send one Expo remote push to THIS device only.
 * Does not touch ESPN poll, followed games, or sent_notification_events.
 */
export async function sendExpoPushToCurrentDevice(
  title: string,
  body: string,
): Promise<ExpoSelfPushResult> {
  const token = await getExistingExpoPushToken();
  if (!token) {
    const failure = getLastPushTokenFailure();
    return {
      ok: false,
      error:
        failure?.safeMessage ??
        'No Expo push token on this device. Grant permission and retry registration first.',
    };
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
        data: { test: true, source: 'developer_self_push' },
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Expo push HTTP ${response.status}` };
    }

    const payload = (await response.json()) as {
      data?: Array<{ status?: string; message?: string }>;
    };
    const ticket = Array.isArray(payload.data) ? payload.data[0] : undefined;
    if (ticket?.status === 'error') {
      return {
        ok: false,
        error: sanitizePushTokenErrorMessage(ticket.message ?? 'Expo push ticket error'),
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Expo push request failed',
    };
  }
}
