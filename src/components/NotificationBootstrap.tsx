import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import type { NotificationResponse } from 'expo-notifications';

import { syncPushTokenIfPermitted } from '@/data/notifications/deviceRegistration';
import { runNotificationStartupSync } from '@/data/notifications/notificationStartupSync';
import { debugLogSupabaseConfig } from '@/data/notifications/supabaseClient';
import {
  addNotificationResponseListener,
  addPushTokenListener,
  clearLastNotificationResponse,
  configureNotificationHandler,
  getEventIdFromNotificationResponse,
  getLastNotificationResponse,
  getNotificationResponseDedupeKey,
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

    // One shared tap handler for cold-start (killed) and live response events.
    const handledResponseKeys = new Set<string>();
    const handleNotificationResponse = (response: NotificationResponse) => {
      const key = getNotificationResponseDedupeKey(response);
      if (handledResponseKeys.has(key)) return;
      handledResponseKeys.add(key);

      const eventId = getEventIdFromNotificationResponse(response);
      if (eventId) {
        router.push('/(tabs)/scores');
      }

      // Avoid replaying this tap on a later ordinary cold start.
      void clearLastNotificationResponse();
    };

    void getLastNotificationResponse()
      .then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      })
      .catch((error) => {
        console.warn('[NotificationBootstrap] last notification response failed:', error);
      });

    const responseSubscription = addNotificationResponseListener(handleNotificationResponse);

    return () => {
      tokenSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);

  return null;
}
