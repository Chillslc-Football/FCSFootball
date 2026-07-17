import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadCachedHeroSportsNews,
  loadStaleHeroSportsNews,
  saveCachedHeroSportsNews,
} from '@/data/news/heroSportsNewsCache';
import { HERO_SPORTS_NEWS_CACHE_TTL_MS } from '@/data/news/heroSportsNewsConstants';
import { fetchHeroSportsFcsNews } from '@/data/news/heroSportsNewsProvider';
import type { NewsArticle } from '@/types/news';

type LoadState = 'loading' | 'success' | 'error';

type RefreshOptions = {
  force?: boolean;
  background?: boolean;
};

export function useHeroSportsNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lastFetchedAtRef = useRef<number>(0);
  const hasInitializedRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const articlesRef = useRef<NewsArticle[]>([]);

  articlesRef.current = articles;

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (inFlightRef.current && !options.force) {
      return inFlightRef.current;
    }

    const run = (async () => {
      const background = options.background ?? false;
      if (!background) {
        setRefreshing(true);
      }

      if (!background && articlesRef.current.length === 0) {
        setLoadState('loading');
      }

      try {
        const payload = await fetchHeroSportsFcsNews();
        setArticles(payload.articles);
        setErrorMessage(null);
        setIsStale(false);
        setLoadState('success');
        lastFetchedAtRef.current = Date.now();
        await saveCachedHeroSportsNews(payload);
      } catch (err) {
        const stale = await loadStaleHeroSportsNews();
        if (stale?.articles.length) {
          setArticles(stale.articles);
          setIsStale(true);
          setLoadState('success');
          setErrorMessage(null);
        } else {
          setArticles([]);
          setLoadState('error');
          setErrorMessage(
            err instanceof Error ? err.message : 'FCS news could not be loaded.',
          );
        }
      } finally {
        setRefreshing(false);
      }
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    void (async () => {
      const cached = await loadCachedHeroSportsNews();
      if (cached?.articles.length) {
        setArticles(cached.articles);
        setLoadState('success');
        lastFetchedAtRef.current = Date.parse(cached.fetchedAt) || Date.now();
      }

      const cacheAge = Date.now() - lastFetchedAtRef.current;
      const shouldRefresh =
        !cached?.articles.length || cacheAge >= HERO_SPORTS_NEWS_CACHE_TTL_MS;

      if (shouldRefresh) {
        await refresh({ background: Boolean(cached?.articles.length) });
      }
    })();
  }, [refresh]);

  const onPullToRefresh = useCallback(async () => {
    await refresh({ force: true });
  }, [refresh]);

  return {
    articles,
    loadState,
    refreshing,
    isStale,
    errorMessage,
    onPullToRefresh,
  };
}
