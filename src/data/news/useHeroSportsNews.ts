import {
  HERO_SPORTS_NEWS_CACHE_KEY,
  HERO_SPORTS_NEWS_CACHE_TTL_MS,
  HERO_SPORTS_NEWS_SOURCE,
} from '@/data/news/heroSportsNewsConstants';
import {
  loadCachedHeroSportsNews,
  loadStaleHeroSportsNews,
  saveCachedHeroSportsNews,
} from '@/data/news/heroSportsNewsCache';
import { fetchHeroSportsFcsNews } from '@/data/news/heroSportsNewsProvider';
import { useNewsSource } from '@/data/news/useNewsSource';

export function useHeroSportsNews() {
  return useNewsSource({
    cacheKey: HERO_SPORTS_NEWS_CACHE_KEY,
    cacheTtlMs: HERO_SPORTS_NEWS_CACHE_TTL_MS,
    source: HERO_SPORTS_NEWS_SOURCE,
    fetchArticles: fetchHeroSportsFcsNews,
    loadCached: loadCachedHeroSportsNews,
    saveCached: saveCachedHeroSportsNews,
    loadStale: loadStaleHeroSportsNews,
  });
}
