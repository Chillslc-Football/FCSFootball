import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAnnouncementCacheFresh } from '@/data/announcement/announcementTtl';
import {
  mapAnnouncementRow,
  type AppAnnouncementDbRow,
} from '@/data/announcement/mapAnnouncementRow';
import type { AppAnnouncement } from '@/data/announcement/types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/data/notifications/supabaseClient';

export { mapAnnouncementRow } from '@/data/announcement/mapAnnouncementRow';

const CACHE_KEY = 'fcs_pulse.app_announcement.cache.v1';

type CacheEnvelope = {
  fetchedAt: number;
  announcement: AppAnnouncement | null;
};

async function readCache(): Promise<CacheEnvelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(announcement: AppAnnouncement | null): Promise<void> {
  const envelope: CacheEnvelope = { fetchedAt: Date.now(), announcement };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
}

export type LoadAnnouncementResult = {
  announcement: AppAnnouncement | null;
  source: 'network' | 'cache' | 'none';
  fetchFailed: boolean;
  error?: string;
};

/**
 * Load announcement for Home.
 * Fail open: network errors do not throw; may return fresh cache or null.
 */
export async function loadAppAnnouncement(options?: {
  forceRefresh?: boolean;
  nowMs?: number;
}): Promise<LoadAnnouncementResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const cache = await readCache();
  const cacheFresh = Boolean(cache) && isAnnouncementCacheFresh(cache!.fetchedAt, nowMs);

  if (!options?.forceRefresh && cacheFresh) {
    return {
      announcement: cache!.announcement,
      source: 'cache',
      fetchFailed: false,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      announcement: null,
      source: 'none',
      fetchFailed: true,
      error: 'supabase_not_configured',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      announcement: null,
      source: 'none',
      fetchFailed: true,
      error: 'supabase_client_unavailable',
    };
  }

  try {
    const { data, error } = await supabase
      .from('app_announcement')
      .select('id, message, active, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const announcement = data ? mapAnnouncementRow(data as AppAnnouncementDbRow) : null;
    await writeCache(announcement);
    return { announcement, source: 'network', fetchFailed: false };
  } catch (error) {
    // Prefer fresh cache only; do not apply stale cache after failed refresh.
    if (cacheFresh && cache) {
      return {
        announcement: cache.announcement,
        source: 'cache',
        fetchFailed: true,
        error: error instanceof Error ? error.message : 'announcement_fetch_failed',
      };
    }
    return {
      announcement: null,
      source: 'none',
      fetchFailed: true,
      error: error instanceof Error ? error.message : 'announcement_fetch_failed',
    };
  }
}

/** Admin save — requires authenticated is_app_admin session (RLS). */
export async function saveAppAnnouncement(input: {
  id: string;
  message: string;
  active: boolean;
}): Promise<AppAnnouncement> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('app_announcement')
    .update({
      message: input.message,
      active: input.active,
    })
    .eq('id', input.id)
    .select('id, message, active, updated_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const mapped = mapAnnouncementRow(data as AppAnnouncementDbRow);
  if (!mapped) {
    throw new Error('Save succeeded but announcement payload was invalid.');
  }

  await writeCache(mapped);
  return mapped;
}

export async function clearAppAnnouncementCacheForTests(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
