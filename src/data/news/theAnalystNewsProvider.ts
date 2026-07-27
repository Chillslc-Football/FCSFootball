import {
  THE_ANALYST_FCS_PAGE_URL,
  THE_ANALYST_FCS_POSTS_URL,
  THE_ANALYST_FCS_RSS_URL,
  THE_ANALYST_NEWS_EXPECTED_MIN_ARTICLES,
  THE_ANALYST_NEWS_FETCH_TIMEOUT_MS,
  THE_ANALYST_NEWS_SOURCE,
  THE_ANALYST_SITE_ORIGIN,
} from '@/data/news/theAnalystNewsConstants';
import { parseRssFeedItems } from '@/data/news/parseRssFeed';
import {
  isValidTheAnalystArticleUrl,
  parseAnalystPageFallbackArticles,
  type AnalystFallbackArticle,
} from '@/data/news/theAnalystStructuredFallback';
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

export { isValidTheAnalystArticleUrl } from '@/data/news/theAnalystStructuredFallback';

function isAllowedTheAnalystImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' && /(^|\.)theanalyst\.com$/i.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/** Exported for fixture tests — parse The Analyst FCS RSS XML. */
export function parseTheAnalystRssXml(xml: string): NewsArticle[] {
  return sortArticlesByPublishedAtDesc(
    dedupeArticlesByUrl(
      parseRssFeedItems(xml, { siteOrigin: THE_ANALYST_SITE_ORIGIN })
        .map((item): NewsArticle | null => {
          if (!item.title || !isValidTheAnalystArticleUrl(item.url)) return null;
          return {
            id: item.guid || normalizeArticleUrl(item.url),
            title: item.title,
            url: item.url,
            imageUrl:
              item.imageUrl && isAllowedTheAnalystImageUrl(item.imageUrl)
                ? item.imageUrl
                : undefined,
            author: item.author,
            publishedAt: item.publishedAt,
            excerpt: item.excerpt,
            source: THE_ANALYST_NEWS_SOURCE,
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

  if (!id || !link || !title || !isValidTheAnalystArticleUrl(link)) {
    return null;
  }

  const excerptHtml = parseRenderedField(post.excerpt);
  const excerpt = excerptHtml ? stripHtml(excerptHtml) : undefined;
  const yoastImage = parseYoastImageUrl(post);
  const imageUrl =
    yoastImage && isAllowedTheAnalystImageUrl(yoastImage) ? yoastImage : undefined;

  return {
    id,
    title,
    url: link,
    imageUrl,
    author: parseYoastAuthorName(post),
    publishedAt,
    excerpt: excerpt || undefined,
    source: THE_ANALYST_NEWS_SOURCE,
  };
}

/** Exported for fixture tests — parse The Analyst WP REST JSON array. */
export function parseTheAnalystWordPressPosts(raw: unknown): NewsArticle[] {
  if (!Array.isArray(raw)) return [];
  return sortArticlesByPublishedAtDesc(
    dedupeArticlesByUrl(
      raw
        .map((post) => parseWordPressPost(post))
        .filter((article): article is NewsArticle => article != null),
    ),
  );
}

function fallbackToNewsArticle(entry: AnalystFallbackArticle): NewsArticle | null {
  if (!entry.title || !isValidTheAnalystArticleUrl(entry.url)) return null;
  return {
    id: normalizeArticleUrl(entry.url),
    title: entry.title,
    url: entry.url,
    publishedAt: entry.publishedAt,
    author: entry.author,
    excerpt: entry.excerpt,
    imageUrl:
      entry.imageUrl && isAllowedTheAnalystImageUrl(entry.imageUrl)
        ? entry.imageUrl
        : undefined,
    source: THE_ANALYST_NEWS_SOURCE,
  };
}

/** Exported for fixture tests — JSON-LD first, then resilient HTML. */
export function parseTheAnalystPageArticles(html: string): NewsArticle[] {
  return sortArticlesByPublishedAtDesc(
    dedupeArticlesByUrl(
      parseAnalystPageFallbackArticles(html)
        .map(fallbackToNewsArticle)
        .filter((article): article is NewsArticle => article != null),
    ),
  );
}

function mergeAnalystArticles(groups: NewsArticle[][]): NewsArticle[] {
  const byUrl = new Map<string, NewsArticle>();

  for (const group of groups) {
    for (const article of group) {
      const key = normalizeArticleUrl(article.url);
      const existing = byUrl.get(key);
      if (!existing) {
        byUrl.set(key, article);
        continue;
      }
      byUrl.set(key, {
        ...existing,
        id: existing.id || article.id,
        title: existing.title || article.title,
        imageUrl: existing.imageUrl || article.imageUrl,
        author: existing.author || article.author,
        publishedAt: existing.publishedAt || article.publishedAt,
        excerpt: existing.excerpt || article.excerpt,
      });
    }
  }

  return sortArticlesByPublishedAtDesc([...byUrl.values()]);
}

async function fetchAnalystRss(
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ articles: NewsArticle[]; status: number }> {
  const response = await fetchWithTimeout(THE_ANALYST_FCS_RSS_URL, {
    signal,
    timeoutMs,
    accept: 'application/rss+xml, application/xml, text/xml, */*',
  });
  if (!response.ok) {
    const details = await readErrorResponseDetails(response);
    throw new Error(`The Analyst RSS failed (${response.status}). ${details}`);
  }
  const xml = await response.text();
  return { articles: parseTheAnalystRssXml(xml), status: response.status };
}

async function fetchAnalystWordPress(
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ articles: NewsArticle[]; status: number }> {
  const response = await fetchWithTimeout(THE_ANALYST_FCS_POSTS_URL, {
    signal,
    timeoutMs,
    accept: 'application/json',
  });
  if (!response.ok) {
    const details = await readErrorResponseDetails(response);
    throw new Error(`The Analyst WP JSON failed (${response.status}). ${details}`);
  }
  const raw = (await response.json()) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error('The Analyst news response was not a JSON array.');
  }
  return { articles: parseTheAnalystWordPressPosts(raw), status: response.status };
}

async function fetchAnalystPageFallback(
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ articles: NewsArticle[]; status: number }> {
  const response = await fetchWithTimeout(THE_ANALYST_FCS_PAGE_URL, {
    signal,
    timeoutMs,
    accept: 'text/html,application/xhtml+xml',
  });
  if (!response.ok) {
    const details = await readErrorResponseDetails(response);
    throw new Error(`The Analyst page fallback failed (${response.status}). ${details}`);
  }
  const html = await response.text();
  const articles = parseTheAnalystPageArticles(html);
  return { articles, status: response.status };
}

export async function fetchTheAnalystFcsNews(
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<NewsArticlesPayload> {
  const timeoutMs = options.timeoutMs ?? THE_ANALYST_NEWS_FETCH_TIMEOUT_MS;
  const requestStartedAt = new Date().toISOString();

  logNewsFetchDev({
    source: THE_ANALYST_NEWS_SOURCE,
    phase: 'start',
    endpoint: `${THE_ANALYST_FCS_RSS_URL} (+ ${THE_ANALYST_FCS_POSTS_URL})`,
    requestStartedAt,
  });

  try {
    const [rssSettled, wpSettled] = await Promise.allSettled([
      fetchAnalystRss(timeoutMs, options.signal),
      fetchAnalystWordPress(timeoutMs, options.signal),
    ]);

    const rssArticles =
      rssSettled.status === 'fulfilled' ? rssSettled.value.articles : [];
    const wpArticles =
      wpSettled.status === 'fulfilled' ? wpSettled.value.articles : [];

    if (rssSettled.status === 'rejected' && __DEV__) {
      console.warn(
        `[News:${THE_ANALYST_NEWS_SOURCE}] RSS unavailable:`,
        rssSettled.reason instanceof Error ? rssSettled.reason.message : rssSettled.reason,
      );
    }
    if (wpSettled.status === 'rejected' && __DEV__) {
      console.warn(
        `[News:${THE_ANALYST_NEWS_SOURCE}] WP JSON unavailable:`,
        wpSettled.reason instanceof Error ? wpSettled.reason.message : wpSettled.reason,
      );
    }

    let articles = mergeAnalystArticles([rssArticles, wpArticles]);
    let endpointUsed =
      rssArticles.length > 0
        ? THE_ANALYST_FCS_RSS_URL
        : wpArticles.length > 0
          ? THE_ANALYST_FCS_POSTS_URL
          : THE_ANALYST_FCS_PAGE_URL;
    let status =
      rssSettled.status === 'fulfilled'
        ? rssSettled.value.status
        : wpSettled.status === 'fulfilled'
          ? wpSettled.value.status
          : undefined;

    // Only scrape the page (JSON-LD / resilient HTML) when structured feeds both fail.
    if (articles.length === 0) {
      if (__DEV__) {
        console.warn(
          `[News:${THE_ANALYST_NEWS_SOURCE}] structured feeds empty; trying JSON-LD/HTML page fallback.`,
        );
      }
      const page = await fetchAnalystPageFallback(timeoutMs, options.signal);
      articles = page.articles;
      endpointUsed = THE_ANALYST_FCS_PAGE_URL;
      status = page.status;
    }

    if (articles.length === 0) {
      throw new Error('The Analyst returned no usable FCS articles from RSS, WP JSON, or page.');
    }

    warnIfSparseArticleCount(
      THE_ANALYST_NEWS_SOURCE,
      articles.length,
      THE_ANALYST_NEWS_EXPECTED_MIN_ARTICLES,
      `endpoint=${endpointUsed}`,
    );

    logNewsFetchDev({
      source: THE_ANALYST_NEWS_SOURCE,
      phase: 'success',
      endpoint: endpointUsed,
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
        `The Analyst news request timed out after ${timeoutMs / 1000} seconds.`,
      );
      logNewsFetchDev({
        source: THE_ANALYST_NEWS_SOURCE,
        phase: 'error',
        endpoint: THE_ANALYST_FCS_RSS_URL,
        requestStartedAt,
        error: timeoutError,
      });
      throw timeoutError;
    }
    logNewsFetchDev({
      source: THE_ANALYST_NEWS_SOURCE,
      phase: 'error',
      endpoint: THE_ANALYST_FCS_RSS_URL,
      requestStartedAt,
      error: err,
    });
    throw err instanceof Error ? err : new Error('The Analyst news request failed.');
  }
}
