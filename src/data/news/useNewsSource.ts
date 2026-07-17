import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadCachedNews,
  loadStaleNews,
  saveCachedNews,
} from '@/data/news/newsSourceCache';
import type { NewsArticle, NewsArticlesPayload, NewsSource } from '@/types/news';

type LoadState = 'loading' | 'success' | 'error';

type RefreshOptions = {
  force?: boolean;
  background?: boolean;
};

type UseNewsSourceConfig = {
  cacheKey: string;
  cacheTtlMs: number;
  source: NewsSource;
  fetchArticles: (options?: { signal?: AbortSignal }) => Promise<NewsArticlesPayload>;
  loadCached?: () => Promise<NewsArticlesPayload | null>;
  saveCached?: (payload: NewsArticlesPayload) => Promise<void>;
  loadStale?: () => Promise<NewsArticlesPayload | null>;
};

export function useNewsSource({
  cacheKey,
  cacheTtlMs,
  source,
  fetchArticles,
  loadCached = () => loadCachedNews(cacheKey, source),
  saveCached = (payload) => saveCachedNews(cacheKey, payload, cacheTtlMs),
  loadStale = () => loadStaleNews(cacheKey, source),
}: UseNewsSourceConfig) {
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

  const refresh = useCallback(
    async (options: RefreshOptions = {}) => {
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
          const payload = await fetchArticles();
          setArticles(payload.articles);
          setErrorMessage(null);
          setIsStale(false);
          setLoadState('success');
          lastFetchedAtRef.current = Date.now();
          await saveCached(payload);
        } catch (err) {
          const stale = await loadStale();
          if (stale?.articles.length) {
            setArticles(stale.articles);
            setIsStale(true);
            setLoadState('success');
            setErrorMessage(null);
          } else {
            setArticles([]);
            setLoadState('error');
            setErrorMessage(err instanceof Error ? err.message : 'News could not be loaded.');
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
    },
    [fetchArticles, loadStale, saveCached],
  );

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    void (async () => {
      const cached = await loadCached();
      if (cached?.articles.length) {
        setArticles(cached.articles);
        setLoadState('success');
        lastFetchedAtRef.current = Date.parse(cached.fetchedAt) || Date.now();
      }

      const cacheAge = Date.now() - lastFetchedAtRef.current;
      const shouldRefresh = !cached?.articles.length || cacheAge >= cacheTtlMs;

      if (shouldRefresh) {
        await refresh({ background: Boolean(cached?.articles.length) });
      }
    })();
  }, [cacheTtlMs, loadCached, refresh]);

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
