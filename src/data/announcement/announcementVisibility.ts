import type { AppAnnouncement } from '@/data/announcement/types';

/** Stable version key for dismissals — changes when owner saves (updated_at). */
export function announcementVersionKey(announcement: Pick<AppAnnouncement, 'id' | 'updatedAt'>): string {
  return `${announcement.id}|${announcement.updatedAt}`;
}

export function isAnnouncementDisplayable(announcement: AppAnnouncement | null | undefined): boolean {
  if (!announcement) return false;
  if (!announcement.active) return false;
  return announcement.message.trim().length > 0;
}

/**
 * Whether Home should show the banner for this announcement + local dismiss state.
 */
export function shouldShowAnnouncement(input: {
  announcement: AppAnnouncement | null | undefined;
  dismissedVersionKey: string | null | undefined;
}): boolean {
  if (!isAnnouncementDisplayable(input.announcement)) return false;
  const version = announcementVersionKey(input.announcement!);
  if (input.dismissedVersionKey && input.dismissedVersionKey === version) {
    return false;
  }
  return true;
}
