import {
  THE_ANALYST_NEWS_CACHE_KEY,
  THE_ANALYST_NEWS_SOURCE,
} from '@/data/news/theAnalystNewsConstants';
import {
  loadCachedNews,
  loadStaleNews,
  saveCachedNews,
} from '@/data/news/newsSourceCache';
import type { NewsArticlesPayload } from '@/types/news';

export async function loadCachedTheAnalystNews(): Promise<NewsArticlesPayload | null> {
  return loadCachedNews(THE_ANALYST_NEWS_CACHE_KEY, THE_ANALYST_NEWS_SOURCE);
}

export async function saveCachedTheAnalystNews(payload: NewsArticlesPayload): Promise<void> {
  await saveCachedNews(THE_ANALYST_NEWS_CACHE_KEY, payload);
}

export async function loadStaleTheAnalystNews(): Promise<NewsArticlesPayload | null> {
  return loadStaleNews(THE_ANALYST_NEWS_CACHE_KEY, THE_ANALYST_NEWS_SOURCE);
}
