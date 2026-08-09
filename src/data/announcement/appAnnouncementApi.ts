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
/** TEMP diagnostics — strip URLs/secrets from error text before logging. */
function sanitizeAnnounceDiagError(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/https?:\/\/\S+/gi, '[redacted_url]').slice(0, 120);
}

function logAnnounceLoadDiag(
  phase: string,
  result: Pick<LoadAnnouncementResult, 'announcement' | 'source' | 'fetchFailed' | 'error'> & {
    called?: boolean;
    hasRow?: boolean;
  },
): void {
  // TEMP: Home announcement read-path diagnosis (remove after investigation).
  console.log('[announce-diag] loadAppAnnouncement', {
    phase,
    called: result.called ?? true,
    hasRow: result.hasRow ?? result.announcement != null,
    message: result.announcement?.message ?? null,
    active: result.announcement?.active ?? null,
    source: result.source,
    fetchFailed: result.fetchFailed,
    error: sanitizeAnnounceDiagError(result.error) ?? null,
  });
}

export async function loadAppAnnouncement(options?: {
  forceRefresh?: boolean;
  nowMs?: number;
}): Promise<LoadAnnouncementResult> {
  // TEMP: Home announcement read-path diagnosis (remove after investigation).
  console.log('[announce-diag] loadAppAnnouncement called', {
    forceRefresh: Boolean(options?.forceRefresh),
  });

  const nowMs = options?.nowMs ?? Date.now();
  const cache = await readCache();
  const cacheFresh = Boolean(cache) && isAnnouncementCacheFresh(cache!.fetchedAt, nowMs);

  if (!options?.forceRefresh && cacheFresh) {
    const result: LoadAnnouncementResult = {
      announcement: cache!.announcement,
      source: 'cache',
      fetchFailed: false,
    };
    logAnnounceLoadDiag('cache_hit', result);
    return result;
  }

  if (!isSupabaseConfigured()) {
    const result: LoadAnnouncementResult = {
      announcement: null,
      source: 'none',
      fetchFailed: true,
      error: 'supabase_not_configured',
    };
    logAnnounceLoadDiag('supabase_not_configured', { ...result, hasRow: false });
    return result;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    const result: LoadAnnouncementResult = {
      announcement: null,
      source: 'none',
      fetchFailed: true,
      error: 'supabase_client_unavailable',
    };
    logAnnounceLoadDiag('supabase_client_unavailable', { ...result, hasRow: false });
    return result;
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
    const result: LoadAnnouncementResult = { announcement, source: 'network', fetchFailed: false };
    logAnnounceLoadDiag('network', { ...result, hasRow: data != null });
    return result;
  } catch (error) {
    // Prefer fresh cache only; do not apply stale cache after failed refresh.
    if (cacheFresh && cache) {
      const result: LoadAnnouncementResult = {
        announcement: cache.announcement,
        source: 'cache',
        fetchFailed: true,
        error: error instanceof Error ? error.message : 'announcement_fetch_failed',
      };
      logAnnounceLoadDiag('network_fail_cache_fallback', result);
      return result;
    }
    const result: LoadAnnouncementResult = {
      announcement: null,
      source: 'none',
      fetchFailed: true,
      error: error instanceof Error ? error.message : 'announcement_fetch_failed',
    };
    logAnnounceLoadDiag('network_fail', { ...result, hasRow: false });
    return result;
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
