import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/data/notifications/supabaseClient';
import type { AppReleasePlatform, AppReleasePolicyRow } from '@/data/release/types';

import {
  APP_RELEASE_POLICY_TTL_MS,
  isReleasePolicyCacheFresh,
} from '@/data/release/releasePolicyTtl';

export { APP_RELEASE_POLICY_TTL_MS, isReleasePolicyCacheFresh };

const CACHE_KEY = 'fcs_pulse.app_release_policy.v1';

type CacheEnvelope = {
  fetchedAt: number;
  rows: AppReleasePolicyRow[];
};

type DbRow = {
  platform: string;
  latest_build: number;
  minimum_supported_build: number;
  latest_version: string | null;
  update_message: string | null;
  required_update_message: string | null;
  store_url: string | null;
  updated_at: string | null;
};

function mapRow(row: DbRow): AppReleasePolicyRow | null {
  if (row.platform !== 'ios' && row.platform !== 'android') return null;
  const latestBuild = Number(row.latest_build);
  const minimumSupportedBuild = Number(row.minimum_supported_build);
  if (!Number.isInteger(latestBuild) || latestBuild < 1) return null;
  if (!Number.isInteger(minimumSupportedBuild) || minimumSupportedBuild < 1) return null;

  return {
    platform: row.platform,
    latestBuild,
    minimumSupportedBuild,
    latestVersion: row.latest_version?.trim() || '1.0.0',
    updateMessage: row.update_message?.trim() || null,
    requiredUpdateMessage: row.required_update_message?.trim() || null,
    storeUrl: row.store_url?.trim() || '',
    updatedAt: row.updated_at,
  };
}

async function readCache(): Promise<CacheEnvelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed || !Array.isArray(parsed.rows) || typeof parsed.fetchedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(rows: AppReleasePolicyRow[]): Promise<void> {
  const envelope: CacheEnvelope = { fetchedAt: Date.now(), rows };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
}

export type LoadReleasePolicyResult = {
  policy: AppReleasePolicyRow | null;
  /** Fresh remote or still-within-TTL cache used for decisions. */
  source: 'network' | 'cache' | 'none';
  /** True when network failed / missing — callers must fail open. */
  fetchFailed: boolean;
  error?: string;
};

/**
 * Load platform policy.
 * - Prefer network when forced or cache expired.
 * - Fresh cache may be used without network.
 * - Network failure with no fresh cache → fail open (policy null, fetchFailed true).
 * - Stale cache is NOT applied for lockout (fail open).
 */
export async function loadAppReleasePolicy(options?: {
  platform: AppReleasePlatform;
  forceRefresh?: boolean;
  nowMs?: number;
}): Promise<LoadReleasePolicyResult> {
  const platform = options?.platform;
  if (!platform) {
    return { policy: null, source: 'none', fetchFailed: true, error: 'missing_platform' };
  }

  const nowMs = options?.nowMs ?? Date.now();
  const cache = await readCache();
  const cachedRow = cache?.rows.find((row) => row.platform === platform) ?? null;
  const cacheFresh =
    Boolean(cache) && isReleasePolicyCacheFresh(cache!.fetchedAt, nowMs);

  if (!options?.forceRefresh && cacheFresh && cachedRow) {
    return { policy: cachedRow, source: 'cache', fetchFailed: false };
  }

  if (!isSupabaseConfigured()) {
    return {
      policy: null,
      source: 'none',
      fetchFailed: true,
      error: 'supabase_not_configured',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      policy: null,
      source: 'none',
      fetchFailed: true,
      error: 'supabase_client_unavailable',
    };
  }

  try {
    const { data, error } = await supabase
      .from('app_release_policy')
      .select(
        'platform, latest_build, minimum_supported_build, latest_version, update_message, required_update_message, store_url, updated_at',
      );

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data as DbRow[] | null ?? [])
      .map(mapRow)
      .filter((row): row is AppReleasePolicyRow => row != null);

    if (rows.length === 0) {
      return { policy: null, source: 'none', fetchFailed: true, error: 'empty_policy' };
    }

    await writeCache(rows);
    const policy = rows.find((row) => row.platform === platform) ?? null;
    if (!policy) {
      return { policy: null, source: 'none', fetchFailed: true, error: 'missing_platform_row' };
    }
    return { policy, source: 'network', fetchFailed: false };
  } catch (error) {
    // Fail open: do not apply stale cache for lockout after a failed refresh.
    return {
      policy: null,
      source: 'none',
      fetchFailed: true,
      error: error instanceof Error ? error.message : 'release_policy_fetch_failed',
    };
  }
}

/** Test helper — clear persisted policy cache. */
export async function clearAppReleasePolicyCacheForTests(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
