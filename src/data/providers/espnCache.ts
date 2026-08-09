import { shouldPollEspnNormalizedStatus } from '@/data/providers/espnGameStatus';
import type { EspnNormalizedGame } from '@/types';

/** TTL when any cached scoreboard includes in-progress / delayed / suspended games. */
export const ESPN_CACHE_TTL_LIVE_MS = 30_000;

/** TTL for upcoming, final, and schedule-only scoreboard payloads. */
export const ESPN_CACHE_TTL_DEFAULT_MS = 5 * 60_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export type EspnScoreboardCachePayload = {
  games: EspnNormalizedGame[];
  raw: Record<string, unknown>;
};

export function resolveEspnCacheTtlMs(games: Pick<EspnNormalizedGame, 'normalizedStatus'>[]): number {
  const hasLive = games.some((game) => shouldPollEspnNormalizedStatus(game.normalizedStatus));
  return hasLive ? ESPN_CACHE_TTL_LIVE_MS : ESPN_CACHE_TTL_DEFAULT_MS;
}

export function getEspnCacheEntry<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
}

export function setEspnCacheEntry<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Drop one cache entry or the entire ESPN in-memory cache. */
export function clearEspnCache(key?: string): void {
  if (key) {
    cache.delete(key);
    inflight.delete(key);
    return;
  }

  cache.clear();
  inflight.clear();
}

export function hasValidEspnCacheEntry(key: string): boolean {
  return getEspnCacheEntry(key) !== undefined;
}

type GetOrFetchEspnCachedOptions<T> = {
  forceRefresh?: boolean;
  ttlMs: number | ((value: T) => number);
};

/**
 * Return a valid cached scoreboard payload or fetch, dedupe in-flight requests,
 * and skip caching failed responses.
 */
export async function getOrFetchEspnCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: GetOrFetchEspnCachedOptions<T>,
): Promise<T> {
  if (!options.forceRefresh) {
    const cached = getEspnCacheEntry<T>(key);
    if (cached !== undefined) {
      console.log('[ESPN Cache] hit', key);
      return cached;
    }
  } else {
    cache.delete(key);
  }

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    console.log('[ESPN Cache] join in-flight', key);
    return existing;
  }

  const promise = fetchFn()
    .then((value) => {
      const ttlMs =
        typeof options.ttlMs === 'function' ? options.ttlMs(value) : options.ttlMs;
      setEspnCacheEntry(key, value, ttlMs);
      console.log('[ESPN Cache] store', key, `${ttlMs / 1000}s`);
      return value;
    })
    .catch((error) => {
      console.log('[ESPN Cache] miss (fetch failed)', key);
      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Logical cache key for getTodayGames — mirrors the scoreboard URL date filter. */
export function buildEspnTodayCacheKey(dateIso: string): string {
  return `espn:today:${dateIso}`;
}

/** Logical cache key for getWeekGames — one entry per configured week and league scope. */
export function buildEspnWeekCacheKey(
  weekId: string,
  league: string = 'fcs',
): string {
  return `espn:week:${weekId}:${league}`;
}

/** Scoreboard endpoint URLs are also valid cache keys for per-date fetches. */
export function buildEspnEndpointCacheKey(endpoint: string): string {
  return `espn:url:${endpoint}`;
}
