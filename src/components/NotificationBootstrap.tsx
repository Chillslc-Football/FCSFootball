import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { syncPushTokenIfPermitted } from '@/data/notifications/deviceRegistration';
import { runNotificationStartupSync } from '@/data/notifications/notificationStartupSync';
import { debugLogSupabaseConfig } from '@/data/notifications/supabaseClient';
import {
  addNotificationResponseListener,
  addPushTokenListener,
  configureNotificationHandler,
  setupAndroidNotificationChannel,
} from '@/services/notifications/notificationService';

/**
 * Sole automatic cold-start writer for push token + register_device.
 * Settings must not duplicate this work for health display.
 */
export function NotificationBootstrap() {
  const router = useRouter();

  useEffect(() => {
    debugLogSupabaseConfig('NotificationBootstrap');
    configureNotificationHandler();
    void setupAndroidNotificationChannel();

    // One shared cold-start sync — Settings waits, then probes read-only.
    void runNotificationStartupSync(async () => {
      await syncPushTokenIfPermitted();
    });

    const tokenSubscription = addPushTokenListener(() => {
      // Native push token rotated — refresh Expo token when already permitted.
      void syncPushTokenIfPermitted();
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
