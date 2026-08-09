import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  loadDismissedAnnouncementVersion,
  saveDismissedAnnouncementVersion,
} from '@/data/announcement/announcementDismissStorage';
import {
  announcementVersionKey,
  shouldShowAnnouncement,
} from '@/data/announcement/announcementVisibility';
import { loadAppAnnouncement } from '@/data/announcement/appAnnouncementApi';
import type { AppAnnouncement } from '@/data/announcement/types';

export function useHomeAnnouncement() {
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);
  const [dismissedVersionKey, setDismissedVersionKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async (options?: { forceRefresh?: boolean }) => {
    try {
      const [loaded, dismissed] = await Promise.all([
        loadAppAnnouncement({ forceRefresh: options?.forceRefresh }),
        loadDismissedAnnouncementVersion(),
      ]);
      setAnnouncement(loaded.announcement);
      setDismissedVersionKey(dismissed);

      // TEMP: Home announcement read-path diagnosis (remove after investigation).
      const show = shouldShowAnnouncement({
        announcement: loaded.announcement,
        dismissedVersionKey: dismissed,
      });
      console.log('[announce-diag] useHomeAnnouncement visibility', {
        shouldShow: show,
        hydratedWillBe: true,
        hasAnnouncement: loaded.announcement != null,
        message: loaded.announcement?.message ?? null,
        active: loaded.announcement?.active ?? null,
        dismissedPresent: dismissed != null,
        fetchFailed: loaded.fetchFailed,
        error: loaded.error
          ? loaded.error.replace(/https?:\/\/\S+/gi, '[redacted_url]').slice(0, 120)
          : null,
      });
    } catch (error) {
      // Never break Home.
      console.warn('[useHomeAnnouncement] refresh failed:', error);
      // TEMP: Home announcement read-path diagnosis (remove after investigation).
      console.log('[announce-diag] useHomeAnnouncement refresh threw', {
        shouldShow: false,
        hasAnnouncement: false,
      });
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refresh({ forceRefresh: false });
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const visible =
    hydrated &&
    shouldShowAnnouncement({
      announcement,
      dismissedVersionKey,
    });

  const dismiss = useCallback(async () => {
    if (!announcement) return;
    const version = announcementVersionKey(announcement);
    try {
      await saveDismissedAnnouncementVersion(version);
      setDismissedVersionKey(version);
    } catch (error) {
      console.warn('[useHomeAnnouncement] dismiss failed:', error);
    }
  }, [announcement]);

  return {
    announcement: visible ? announcement : null,
    visible,
    dismiss,
    refresh,
  };
}
