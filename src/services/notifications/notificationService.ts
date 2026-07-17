import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
    lightColor: '#C9A227',
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

export async function registerForPushNotifications(): Promise<string | null> {
  configureNotificationHandler();
  await setupAndroidNotificationChannel();

  if (!Device.isDevice) {
    console.warn('[notificationService] Push notifications require a physical device.');
    return null;
  }

  const permission = await requestNotificationPermissions();
  if (permission !== 'granted') {
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    console.warn(
      '[notificationService] EXPO_PUBLIC_EAS_PROJECT_ID is missing — cannot register push token.',
    );
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.warn('[notificationService] Failed to register Expo push token:', error);
    return null;
  }
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
