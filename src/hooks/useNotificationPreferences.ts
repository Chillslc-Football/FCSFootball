import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import {
  ensureNotificationReady,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/data/notifications/deviceRegistration';
import type { NotificationPermissionStatus, NotificationPreferences } from '@/data/notifications/types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/data/notifications/types';
import {
  getNotificationPermissionStatus,
} from '@/services/notifications/notificationService';

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>('undetermined');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [prefs, permission] = await Promise.all([
      loadNotificationPreferences(),
      getNotificationPermissionStatus(),
    ]);
    setPreferences(prefs);
    setPermissionStatus(permission);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updatePreference = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      const next = { ...preferences, ...patch };
      setPreferences(next);
      setSaving(true);
      try {
        if (patch.favoriteGamesEnabled === true) {
          await ensureNotificationReady({ requestPermission: true });
        }
        await saveNotificationPreferences(next);
        setPermissionStatus(await getNotificationPermissionStatus());
      } finally {
        setSaving(false);
      }
    },
    [preferences],
  );

  const openSystemSettings = useCallback(async () => {
    await Linking.openSettings();
    setPermissionStatus(await getNotificationPermissionStatus());
  }, []);

  return {
    preferences,
    permissionStatus,
    loaded,
    saving,
    updatePreference,
    openSystemSettings,
    refresh,
  };
}
