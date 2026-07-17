import {
  THE_ANALYST_NEWS_CACHE_KEY,
  THE_ANALYST_NEWS_CACHE_TTL_MS,
  THE_ANALYST_NEWS_SOURCE,
} from '@/data/news/theAnalystNewsConstants';
import {
  loadCachedTheAnalystNews,
  loadStaleTheAnalystNews,
  saveCachedTheAnalystNews,
} from '@/data/news/theAnalystNewsCache';
import { fetchTheAnalystFcsNews } from '@/data/news/theAnalystNewsProvider';
import { useNewsSource } from '@/data/news/useNewsSource';

export function useTheAnalystNews() {
  return useNewsSource({
    cacheKey: THE_ANALYST_NEWS_CACHE_KEY,
    cacheTtlMs: THE_ANALYST_NEWS_CACHE_TTL_MS,
    source: THE_ANALYST_NEWS_SOURCE,
    fetchArticles: fetchTheAnalystFcsNews,
    loadCached: loadCachedTheAnalystNews,
    saveCached: saveCachedTheAnalystNews,
    loadStale: loadStaleTheAnalystNews,
  });
}
