import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { updateDevicePushToken } from '@/data/notifications/deviceRegistration';
import {
  addNotificationResponseListener,
  addPushTokenListener,
  configureNotificationHandler,
  setupAndroidNotificationChannel,
} from '@/services/notifications/notificationService';

export function NotificationBootstrap() {
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandler();
    void setupAndroidNotificationChannel();

    const tokenSubscription = addPushTokenListener((token) => {
      void updateDevicePushToken(token.data);
    });

    const responseSubscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const eventId = typeof data?.eventId === 'string' ? data.eventId : undefined;
      if (eventId) {
        router.push('/(tabs)/scores');
      }
    });

    return () => {
      tokenSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);

  return null;
}
