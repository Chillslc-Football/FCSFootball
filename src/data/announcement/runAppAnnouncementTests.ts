/**
 * Home announcement visibility / dismiss / mapping tests.
 * Run: npm.cmd run test:app-announcement
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  announcementVersionKey,
  isAnnouncementDisplayable,
  shouldShowAnnouncement,
} from '@/data/announcement/announcementVisibility';
import { isAnnouncementCacheFresh } from '@/data/announcement/announcementTtl';
import { mapAnnouncementRow } from '@/data/announcement/mapAnnouncementRow';
import type { AppAnnouncement } from '@/data/announcement/types';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

function announcement(partial?: Partial<AppAnnouncement>): AppAnnouncement {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    message: 'Live scoring for some games is currently delayed.',
    active: true,
    updatedAt: '2026-08-08T12:00:00.000Z',
    ...partial,
  };
}

function main(): void {
  test('1: Active + nonblank message → shown', () => {
    assert.equal(
      shouldShowAnnouncement({
        announcement: announcement(),
        dismissedVersionKey: null,
      }),
      true,
    );
    assert.equal(isAnnouncementDisplayable(announcement()), true);
  });

  test('2: Inactive message → hidden', () => {
    assert.equal(
      shouldShowAnnouncement({
        announcement: announcement({ active: false }),
        dismissedVersionKey: null,
      }),
      false,
    );
  });

  test('3: Blank active message → hidden', () => {
    assert.equal(
      shouldShowAnnouncement({
        announcement: announcement({ message: '   ' }),
        dismissedVersionKey: null,
      }),
      false,
    );
  });

  test('4: User dismisses current announcement → hidden', () => {
    const current = announcement();
    const dismissed = announcementVersionKey(current);
    assert.equal(
      shouldShowAnnouncement({
        announcement: current,
        dismissedVersionKey: dismissed,
      }),
      false,
    );
  });

  test('5: Same announcement returns from server → remains hidden', () => {
    const current = announcement();
    const dismissed = announcementVersionKey(current);
    const sameAgain = announcement({
      message: current.message,
      updatedAt: current.updatedAt,
    });
    assert.equal(
      shouldShowAnnouncement({
        announcement: sameAgain,
        dismissedVersionKey: dismissed,
      }),
      false,
    );
  });

  test('6: Message updated / updated_at changes → appears again', () => {
    const previous = announcement();
    const dismissed = announcementVersionKey(previous);
    const updated = announcement({
      message: 'Live scoring has been fixed.',
      updatedAt: '2026-08-08T15:00:00.000Z',
    });
    assert.notEqual(announcementVersionKey(updated), dismissed);
    assert.equal(
      shouldShowAnnouncement({
        announcement: updated,
        dismissedVersionKey: dismissed,
      }),
      true,
    );
  });

  test('7: Fetch failure → Home does not fail (null announcement hidden)', () => {
    assert.equal(
      shouldShowAnnouncement({
        announcement: null,
        dismissedVersionKey: null,
      }),
      false,
    );
  });

  test('8: Admin save changes updated_at/version (mapping + version key)', () => {
    const before = mapAnnouncementRow({
      id: '00000000-0000-4000-8000-0000000000a1',
      message: 'Old',
      active: true,
      updated_at: '2026-08-08T12:00:00.000Z',
    });
    const after = mapAnnouncementRow({
      id: '00000000-0000-4000-8000-0000000000a1',
      message: 'New',
      active: true,
      updated_at: '2026-08-08T12:05:00.000Z',
    });
    assert.ok(before && after);
    assert.notEqual(announcementVersionKey(before!), announcementVersionKey(after!));
    assert.equal(after!.message, 'New');
  });

  test('9: Normal user cannot write — RLS policies in migration', () => {
    const sql = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260808190000_app_announcement.sql'),
      'utf8',
    );
    assert.match(sql, /app_announcement_public_read/);
    assert.match(sql, /app_announcement_admin_update/);
    assert.match(sql, /is_app_admin\(\)/);
    assert.match(sql, /grant select on table public\.app_announcement to anon, authenticated/);
    assert.match(sql, /grant update on table public\.app_announcement to authenticated/);
    assert.doesNotMatch(sql, /grant insert on table public\.app_announcement to anon/);
    assert.match(sql, /active boolean not null default false/);
    assert.match(sql, /'',\s*\n\s*false/);
  });

  test('cache TTL helper', () => {
    const now = 1_000_000;
    assert.equal(isAnnouncementCacheFresh(now - 1000, now, 5000), true);
    assert.equal(isAnnouncementCacheFresh(now - 6000, now, 5000), false);
  });

  console.log('\nAll app announcement tests passed.');
}

main();
