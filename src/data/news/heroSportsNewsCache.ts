import AsyncStorage from '@react-native-async-storage/async-storage';

import { HERO_SPORTS_NEWS_CACHE_KEY, HERO_SPORTS_NEWS_CACHE_TTL_MS } from '@/data/news/heroSportsNewsConstants';
import type { NewsArticlesPayload } from '@/types/news';

type CachedNewsEntry = NewsArticlesPayload & {
  expiresAt: number;
};

let memoryFallback: CachedNewsEntry | null = null;

function isAsyncStorageReady(): boolean {
  return (
    typeof AsyncStorage?.getItem === 'function' &&
    typeof AsyncStorage?.setItem === 'function'
  );
}

function normalizePayload(value: unknown): NewsArticlesPayload | null {
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
      item.source === 'HERO Sports'
    );
  });

  return { articles, fetchedAt: record.fetchedAt };
}

export async function loadCachedHeroSportsNews(): Promise<NewsArticlesPayload | null> {
  const readEntry = (entry: CachedNewsEntry | null): NewsArticlesPayload | null => {
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) return null;
    return { articles: entry.articles, fetchedAt: entry.fetchedAt };
  };

  if (!isAsyncStorageReady()) {
    return readEntry(memoryFallback);
  }

  try {
    const raw = await AsyncStorage.getItem(HERO_SPORTS_NEWS_CACHE_KEY);
    if (!raw) return readEntry(memoryFallback);

    const parsed = JSON.parse(raw) as CachedNewsEntry;
    const payload = normalizePayload(parsed);
    if (!payload || typeof parsed.expiresAt !== 'number') return null;

    return readEntry({ ...payload, expiresAt: parsed.expiresAt });
  } catch {
    return readEntry(memoryFallback);
  }
}

export async function saveCachedHeroSportsNews(payload: NewsArticlesPayload): Promise<void> {
  const entry: CachedNewsEntry = {
    ...payload,
    expiresAt: Date.now() + HERO_SPORTS_NEWS_CACHE_TTL_MS,
  };

  memoryFallback = entry;

  if (!isAsyncStorageReady()) return;

  try {
    await AsyncStorage.setItem(HERO_SPORTS_NEWS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // In-memory fallback already updated.
  }
}

/** True when cached articles exist but TTL has elapsed — still usable as stale fallback. */
export async function loadStaleHeroSportsNews(): Promise<NewsArticlesPayload | null> {
  if (memoryFallback?.articles.length) {
    return { articles: memoryFallback.articles, fetchedAt: memoryFallback.fetchedAt };
  }

  if (!isAsyncStorageReady()) return null;

  try {
    const raw = await AsyncStorage.getItem(HERO_SPORTS_NEWS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedNewsEntry;
    return normalizePayload(parsed);
  } catch {
    return null;
  }
}
