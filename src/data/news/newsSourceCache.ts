import AsyncStorage from '@react-native-async-storage/async-storage';

import { HERO_SPORTS_NEWS_CACHE_TTL_MS } from '@/data/news/heroSportsNewsConstants';
import type { NewsArticlesPayload, NewsSource } from '@/types/news';

type CachedNewsEntry = NewsArticlesPayload & {
  expiresAt: number;
};

const memoryFallbackByKey = new Map<string, CachedNewsEntry>();

function isAsyncStorageReady(): boolean {
  return (
    typeof AsyncStorage?.getItem === 'function' &&
    typeof AsyncStorage?.setItem === 'function'
  );
}

function normalizePayload(value: unknown, source: NewsSource): NewsArticlesPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.articles)) return null;
  if (typeof record.fetchedAt !== 'string') return null;

  const articles = record.articles.filter((article): article is NewsArticlesPayload['articles'][number] => {
    if (typeof article !== 'object' || article === null) return false;
    const item = article as Record<string, unknown>;
    return (
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.url === 'string' &&
      item.source === source
    );
  });

  return { articles, fetchedAt: record.fetchedAt };
}

function readFreshEntry(entry: CachedNewsEntry | null): NewsArticlesPayload | null {
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) return null;
  return { articles: entry.articles, fetchedAt: entry.fetchedAt };
}

export async function loadCachedNews(
  cacheKey: string,
  source: NewsSource,
): Promise<NewsArticlesPayload | null> {
  const memoryEntry = memoryFallbackByKey.get(cacheKey) ?? null;

  if (!isAsyncStorageReady()) {
    return readFreshEntry(memoryEntry);
  }

  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return readFreshEntry(memoryEntry);

    const parsed = JSON.parse(raw) as CachedNewsEntry;
    const payload = normalizePayload(parsed, source);
    if (!payload || typeof parsed.expiresAt !== 'number') return null;

    return readFreshEntry({ ...payload, expiresAt: parsed.expiresAt });
  } catch {
    return readFreshEntry(memoryEntry);
  }
}

export async function saveCachedNews(
  cacheKey: string,
  payload: NewsArticlesPayload,
  ttlMs: number = HERO_SPORTS_NEWS_CACHE_TTL_MS,
): Promise<void> {
  const entry: CachedNewsEntry = {
    ...payload,
    expiresAt: Date.now() + ttlMs,
  };

  memoryFallbackByKey.set(cacheKey, entry);

  if (!isAsyncStorageReady()) return;

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // In-memory fallback already updated.
  }
}

/** True when cached articles exist but TTL has elapsed — still usable as stale fallback. */
export async function loadStaleNews(
  cacheKey: string,
  source: NewsSource,
): Promise<NewsArticlesPayload | null> {
  const memoryEntry = memoryFallbackByKey.get(cacheKey);
  if (memoryEntry?.articles.length) {
    return { articles: memoryEntry.articles, fetchedAt: memoryEntry.fetchedAt };
  }

  if (!isAsyncStorageReady()) return null;

  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedNewsEntry;
    return normalizePayload(parsed, source);
  } catch {
    return null;
  }
}
