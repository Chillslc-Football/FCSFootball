/** The Analyst FCS category — verified via /wp-json/wp/v2/categories?search=fcs-football */
export const THE_ANALYST_FCS_CATEGORY_ID = 17;

/** Category RSS — primary structured feed. */
export const THE_ANALYST_FCS_RSS_URL = `https://theanalyst.com/feed/?cat=${THE_ANALYST_FCS_CATEGORY_ID}`;

/** Server-rendered page — JSON-LD / HTML fallback only when structured feeds fail. */
export const THE_ANALYST_FCS_PAGE_URL =
  'https://theanalyst.com/competition/fcs-football/articles';

/**
 * WordPress REST API — structured metadata fallback / enrichment.
 * Avoid `_embed` (can 500 with cache-bust params and omit newer posts).
 */
export const THE_ANALYST_FCS_POSTS_URL = `https://theanalyst.com/wp-json/wp/v2/posts?categories=${THE_ANALYST_FCS_CATEGORY_ID}&per_page=20&orderby=date&order=desc`;

export const THE_ANALYST_NEWS_SOURCE = 'The Analyst' as const;

export const THE_ANALYST_NEWS_FETCH_TIMEOUT_MS = 15_000;

/** Cache successful article lists for 20 minutes. */
export const THE_ANALYST_NEWS_CACHE_TTL_MS = 20 * 60_000;

export const THE_ANALYST_NEWS_CACHE_KEY = 'news:the-analyst';

export const THE_ANALYST_SITE_ORIGIN = 'https://theanalyst.com';

/** Soft minimum for sparse-feed warnings (RSS often returns many more). */
export const THE_ANALYST_NEWS_EXPECTED_MIN_ARTICLES = 5;
