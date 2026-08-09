import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS,
  raceTimeout,
} from '@/data/notifications/notificationSetup';
import type { NotificationPermissionStatus } from '@/data/notifications/types';

export const GAME_ALERTS_CHANNEL_ID = 'game-alerts';

let handlerConfigured = false;

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

async function fetchExpoPushTokenOnce(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[notificationService] Push notifications require a physical device.');
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    console.warn(
      '[notificationService] Expo projectId is missing — cannot register push token.',
    );
    return null;
  }

  try {
    const token = await raceTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      NOTIFICATION_PUSH_TOKEN_TIMEOUT_MS,
      'Expo push token request timed out',
    );
    return token.data;
  } catch (error) {
    console.warn('[notificationService] Failed to register Expo push token:', error);
    return null;
  }
}

/** One transport-style retry for cold-start Expo token failures. */
async function fetchExpoPushToken(): Promise<string | null> {
  const first = await fetchExpoPushTokenOnce();
  if (first) return first;
  await sleep(EXPO_PUSH_TOKEN_RETRY_DELAY_MS);
  return fetchExpoPushTokenOnce();
}

export function hasExpoProjectIdConfigured(): boolean {
  return Boolean(resolveExpoProjectId());
}

/**
 * Returns an Expo push token only when OS permission is already granted.
 * Does not prompt the user.
 */
export async function getExistingExpoPushToken(): Promise<string | null> {
  const permission = await getNotificationPermissionStatus();
  if (permission !== 'granted') {
    return null;
  }

  configureNotificationHandler();
  await setupAndroidNotificationChannel();
  return fetchExpoPushToken();
}

export async function registerForPushNotifications(): Promise<string | null> {
  configureNotificationHandler();
  await setupAndroidNotificationChannel();

  const permission = await requestNotificationPermissions();
  if (permission !== 'granted') {
    return null;
  }

  return fetchExpoPushToken();
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
    return {
      ok: false,
      error: 'No Expo push token on this device. Grant permission and retry registration first.',
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
      return { ok: false, error: ticket.message ?? 'Expo push ticket error' };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Expo push request failed',
    };
  }
}
