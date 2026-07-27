import {
  HERO_SPORTS_FCS_POSTS_URL,
  HERO_SPORTS_FCS_RSS_URL,
  HERO_SPORTS_NEWS_EXPECTED_MIN_ARTICLES,
  HERO_SPORTS_NEWS_FETCH_TIMEOUT_MS,
  HERO_SPORTS_NEWS_SOURCE,
  HERO_SPORTS_SITE_ORIGIN,
} from '@/data/news/heroSportsNewsConstants';
import { parseRssFeedItems } from '@/data/news/parseRssFeed';
import {
  asString,
  dedupeArticlesByUrl,
  fetchWithTimeout,
  isRecord,
  logNewsFetchDev,
  normalizeArticleUrl,
  parseRenderedField,
  parseWordPressPublishedAt,
  parseYoastAuthorName,
  parseYoastImageUrl,
  readErrorResponseDetails,
  sortArticlesByPublishedAtDesc,
  stripHtml,
  warnIfSparseArticleCount,
} from '@/data/news/newsUtils';
import type { NewsArticle, NewsArticlesPayload } from '@/types/news';

const HERO_SPORTS_HOST_PATTERN = /(^|\.)herosports\.com$/i;

export function isValidHeroSportsArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && HERO_SPORTS_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** Exported for fixture tests — parse HERO Sports FCS RSS XML. */
export function parseHeroSportsRssXml(xml: string): NewsArticle[] {
  return sortArticlesByPublishedAtDesc(
    dedupeArticlesByUrl(
      parseRssFeedItems(xml, { siteOrigin: HERO_SPORTS_SITE_ORIGIN })
        .map((item): NewsArticle | null => {
          if (!item.title || !isValidHeroSportsArticleUrl(item.url)) return null;
          return {
            id: item.guid || normalizeArticleUrl(item.url),
            title: item.title,
            url: item.url,
            imageUrl: item.imageUrl,
            author: item.author,
            publishedAt: item.publishedAt,
            excerpt: item.excerpt,
            source: HERO_SPORTS_NEWS_SOURCE,
          };
        })
        .filter((article): article is NewsArticle => article != null),
    ),
  );
}

function parseWordPressPost(post: unknown): NewsArticle | null {
  if (!isRecord(post)) return null;

  const id = asString(post.id);
  const link = asString(post.link);
  const titleHtml = parseRenderedField(post.title);
  const title = titleHtml ? stripHtml(titleHtml) : undefined;
  const publishedAt = parseWordPressPublishedAt(post);

  if (!id || !link || !title || !isValidHeroSportsArticleUrl(link)) {
    return null;
  }

  const excerptHtml = parseRenderedField(post.excerpt);
  const excerpt = excerptHtml ? stripHtml(excerptHtml) : undefined;

  return {
    id,
    title,
    url: link,
    imageUrl: parseYoastImageUrl(post),
    author: parseYoastAuthorName(post),
    publishedAt,
    excerpt: excerpt || undefined,
    source: HERO_SPORTS_NEWS_SOURCE,
  };
}

/** Exported for fixture tests — parse HERO Sports WP REST JSON array. */
export function parseHeroSportsWordPressPosts(raw: unknown): NewsArticle[] {
  if (!Array.isArray(raw)) return [];
  return sortArticlesByPublishedAtDesc(
    dedupeArticlesByUrl(
      raw
        .map((post) => parseWordPressPost(post))
        .filter((article): article is NewsArticle => article != null),
    ),
  );
}

function mergeHeroArticles(
  primary: NewsArticle[],
  enrichment: NewsArticle[],
): NewsArticle[] {
  if (primary.length === 0) return enrichment;
  if (enrichment.length === 0) return primary;

  const byUrl = new Map(
    enrichment.map((article) => [normalizeArticleUrl(article.url), article] as const),
  );

  const merged = primary.map((article) => {
    const extra = byUrl.get(normalizeArticleUrl(article.url));
    if (!extra) return article;
    return {
      ...article,
      id: article.id || extra.id,
      imageUrl: article.imageUrl || extra.imageUrl,
      author: article.author || extra.author,
      publishedAt: article.publishedAt || extra.publishedAt,
      excerpt: article.excerpt || extra.excerpt,
    };
  });

  // Keep enrichment-only newer posts that RSS missed (same category).
  for (const article of enrichment) {
    const key = normalizeArticleUrl(article.url);
    if (!merged.some((entry) => normalizeArticleUrl(entry.url) === key)) {
      merged.push(article);
    }
  }

  return sortArticlesByPublishedAtDesc(dedupeArticlesByUrl(merged));
}

async function fetchHeroRss(
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ articles: NewsArticle[]; status: number }> {
  const response = await fetchWithTimeout(HERO_SPORTS_FCS_RSS_URL, {
    signal,
    timeoutMs,
    accept: 'application/rss+xml, application/xml, text/xml, */*',
  });
  if (!response.ok) {
    const details = await readErrorResponseDetails(response);
    throw new Error(`HERO Sports RSS failed (${response.status}). ${details}`);
  }
  const xml = await response.text();
  return { articles: parseHeroSportsRssXml(xml), status: response.status };
}

async function fetchHeroWordPress(
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ articles: NewsArticle[]; status: number }> {
  const response = await fetchWithTimeout(HERO_SPORTS_FCS_POSTS_URL, {
    signal,
    timeoutMs,
    accept: 'application/json',
  });
  if (!response.ok) {
    const details = await readErrorResponseDetails(response);
    throw new Error(`HERO Sports WP JSON failed (${response.status}). ${details}`);
  }
  const raw = (await response.json()) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error('HERO Sports news response was not a JSON array.');
  }
  return { articles: parseHeroSportsWordPressPosts(raw), status: response.status };
}

export async function fetchHeroSportsFcsNews(
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<NewsArticlesPayload> {
  const timeoutMs = options.timeoutMs ?? HERO_SPORTS_NEWS_FETCH_TIMEOUT_MS;
  const requestStartedAt = new Date().toISOString();

  logNewsFetchDev({
    source: HERO_SPORTS_NEWS_SOURCE,
    phase: 'start',
    endpoint: `${HERO_SPORTS_FCS_RSS_URL} (+ ${HERO_SPORTS_FCS_POSTS_URL} fallback)`,
    requestStartedAt,
  });

  try {
    // Prefer RSS; fetch WP in parallel for enrichment / fallback.
    const [rssSettled, wpSettled] = await Promise.allSettled([
      fetchHeroRss(timeoutMs, options.signal),
      fetchHeroWordPress(timeoutMs, options.signal),
    ]);

    const rssArticles =
      rssSettled.status === 'fulfilled' ? rssSettled.value.articles : [];
    const wpArticles =
      wpSettled.status === 'fulfilled' ? wpSettled.value.articles : [];

    if (rssSettled.status === 'rejected' && __DEV__) {
      console.warn(
        `[News:${HERO_SPORTS_NEWS_SOURCE}] RSS unavailable:`,
        rssSettled.reason instanceof Error ? rssSettled.reason.message : rssSettled.reason,
      );
    }
    if (wpSettled.status === 'rejected' && __DEV__) {
      console.warn(
        `[News:${HERO_SPORTS_NEWS_SOURCE}] WP JSON unavailable:`,
        wpSettled.reason instanceof Error ? wpSettled.reason.message : wpSettled.reason,
      );
    }

    const articles =
      rssArticles.length > 0
        ? mergeHeroArticles(rssArticles, wpArticles)
        : wpArticles;

    if (articles.length === 0) {
      throw new Error('HERO Sports returned no usable FCS articles from RSS or WP JSON.');
    }

    warnIfSparseArticleCount(
      HERO_SPORTS_NEWS_SOURCE,
      articles.length,
      HERO_SPORTS_NEWS_EXPECTED_MIN_ARTICLES,
      rssArticles.length > 0 ? 'source=rss(+wp)' : 'source=wp-json',
    );

    const status =
      rssSettled.status === 'fulfilled'
        ? rssSettled.value.status
        : wpSettled.status === 'fulfilled'
          ? wpSettled.value.status
          : undefined;

    logNewsFetchDev({
      source: HERO_SPORTS_NEWS_SOURCE,
      phase: 'success',
      endpoint: rssArticles.length > 0 ? HERO_SPORTS_FCS_RSS_URL : HERO_SPORTS_FCS_POSTS_URL,
      requestStartedAt,
      status,
      articleCount: articles.length,
      newestTitle: articles[0]?.title,
      newestUrl: articles[0]?.url,
      newestPublishedAt: articles[0]?.publishedAt,
    });

    return {
      articles,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutError = new Error(
        `HERO Sports news request timed out after ${timeoutMs / 1000} seconds.`,
      );
      logNewsFetchDev({
        source: HERO_SPORTS_NEWS_SOURCE,
        phase: 'error',
        endpoint: HERO_SPORTS_FCS_RSS_URL,
        requestStartedAt,
        error: timeoutError,
      });
      throw timeoutError;
    }
    logNewsFetchDev({
      source: HERO_SPORTS_NEWS_SOURCE,
      phase: 'error',
      endpoint: HERO_SPORTS_FCS_RSS_URL,
      requestStartedAt,
      error: err,
    });
    throw err instanceof Error ? err : new Error('HERO Sports news request failed.');
  }
}
