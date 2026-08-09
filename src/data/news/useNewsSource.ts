import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadCachedNews,
  loadStaleNews,
  saveCachedNews,
} from '@/data/news/newsSourceCache';
import { logNewsFetchDev, sortArticlesByPublishedAtDesc } from '@/data/news/newsUtils';
import type { NewsArticle, NewsArticlesPayload, NewsSource } from '@/types/news';

type LoadState = 'loading' | 'success' | 'error';

export type NewsRefreshOptions = {
  /** Join an in-flight refresh instead of starting a second one when falsey/omitted. */
  force?: boolean;
  /** When true, do not flip the pull-to-refresh spinner or full-screen loading state. */
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

function newestArticleSummary(articles: NewsArticle[]): {
  newestTitle?: string;
  newestPublishedAt?: string;
} {
  const sorted = sortArticlesByPublishedAtDesc(articles);
  const newest = sorted[0];
  return {
    newestTitle: newest?.title,
    newestPublishedAt: newest?.publishedAt,
  };
}

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
  /** True for any in-flight live fetch (including background focus refresh). */
  const [isFetching, setIsFetching] = useState(false);
  /** True only after a live fetch fails while cached/previous stories are still shown. */
  const [isStale, setIsStale] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasHydratedRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const articlesRef = useRef<NewsArticle[]>([]);

  articlesRef.current = articles;

  const refresh = useCallback(
    async (options: NewsRefreshOptions = {}) => {
      // Always coalesce concurrent callers — including pull-to-refresh — onto one network pass.
      if (inFlightRef.current) {
        return inFlightRef.current;
      }

      const run = (async () => {
        const background = options.background ?? false;
        setIsFetching(true);
        if (!background) {
          setRefreshing(true);
        }

        if (!background && articlesRef.current.length === 0) {
          setLoadState('loading');
        }

        try {
          logNewsFetchDev({ source, phase: 'start' });
          const payload = await fetchArticles();
          const articlesNewestFirst = sortArticlesByPublishedAtDesc(payload.articles);
          const summary = newestArticleSummary(articlesNewestFirst);

          logNewsFetchDev({
            source,
            phase: 'success',
            articleCount: articlesNewestFirst.length,
            newestTitle: summary.newestTitle,
            newestPublishedAt: summary.newestPublishedAt,
          });

          setArticles(articlesNewestFirst);
          setErrorMessage(null);
          setIsStale(false);
          setLoadState('success');
          await saveCached({
            articles: articlesNewestFirst,
            fetchedAt: payload.fetchedAt,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'News could not be loaded.';
          console.warn(`[News:${source}] live fetch failed:`, message, err);

          const stale = await loadStale();
          if (stale?.articles.length) {
            const staleArticles = sortArticlesByPublishedAtDesc(stale.articles);
            logNewsFetchDev({
              source,
              phase: 'stale-fallback',
              articleCount: staleArticles.length,
              error: err,
            });
            setArticles(staleArticles);
            setIsStale(true);
            setLoadState('success');
            // Keep prior UI content; surface failure via unavailable banner + logs.
            setErrorMessage(message);
          } else if (articlesRef.current.length > 0) {
            setIsStale(true);
            setLoadState('success');
            setErrorMessage(message);
          } else {
            setArticles([]);
            setLoadState('error');
            setErrorMessage(message);
          }
        } finally {
          setRefreshing(false);
          setIsFetching(false);
        }
      })();

      inFlightRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightRef.current === run) {
          inFlightRef.current = null;
        }
      }
    },
    [fetchArticles, loadStale, saveCached, source],
  );

  // Hydrate from any local cache immediately. Live network refresh is owned by the
  // News screen (focus + pull-to-refresh) so both sources stay in sync.
  // TTL-expired cache is normal — do not mark isStale (that means a live fetch failed).
  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;

    void (async () => {
      try {
        const fresh = await loadCached();
        const cached = fresh ?? (await loadStale());
        if (cached?.articles.length) {
          const cachedArticles = sortArticlesByPublishedAtDesc(cached.articles);
          setArticles(cachedArticles);
          setLoadState('success');
          return;
        }
        // No cache yet — kick off a live fetch so the first open is not blank.
        await refresh({ background: false });
      } catch (err) {
        console.warn(`[News:${source}] cache hydrate failed:`, err);
        await refresh({ background: false });
      }
    })();
  }, [loadCached, loadStale, refresh, source]);

  const onPullToRefresh = useCallback(async () => {
    await refresh({ force: true });
  }, [refresh]);

  return {
    articles,
    loadState,
    refreshing,
    isFetching,
    isStale,
    errorMessage,
    refresh,
    onPullToRefresh,
  };
}
