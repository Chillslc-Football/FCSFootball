import type { AppAnnouncement } from '@/data/announcement/types';

export type AppAnnouncementDbRow = {
  id: string;
  message: string | null;
  active: boolean | null;
  updated_at: string | null;
};

export function mapAnnouncementRow(row: AppAnnouncementDbRow): AppAnnouncement | null {
  const id = row.id?.trim();
  if (!id) return null;
  return {
    id,
    message: typeof row.message === 'string' ? row.message : '',
    active: Boolean(row.active),
    updatedAt: row.updated_at?.trim() || new Date(0).toISOString(),
  };
}
