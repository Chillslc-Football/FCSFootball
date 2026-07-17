import {
  HERO_SPORTS_NEWS_CACHE_KEY,
  HERO_SPORTS_NEWS_SOURCE,
} from '@/data/news/heroSportsNewsConstants';
import {
  loadCachedNews,
  loadStaleNews,
  saveCachedNews,
} from '@/data/news/newsSourceCache';
import type { NewsArticlesPayload } from '@/types/news';

export async function loadCachedHeroSportsNews(): Promise<NewsArticlesPayload | null> {
  return loadCachedNews(HERO_SPORTS_NEWS_CACHE_KEY, HERO_SPORTS_NEWS_SOURCE);
}

export async function saveCachedHeroSportsNews(payload: NewsArticlesPayload): Promise<void> {
  await saveCachedNews(HERO_SPORTS_NEWS_CACHE_KEY, payload);
}

export async function loadStaleHeroSportsNews(): Promise<NewsArticlesPayload | null> {
  return loadStaleNews(HERO_SPORTS_NEWS_CACHE_KEY, HERO_SPORTS_NEWS_SOURCE);
}
