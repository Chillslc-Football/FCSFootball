/** The Analyst FCS category — verified via /wp-json/wp/v2/categories?search=fcs-football */
export const THE_ANALYST_FCS_CATEGORY_ID = 17;

/** Server-rendered page-one listing — used for featured-first ordering. */
export const THE_ANALYST_FCS_PAGE_URL =
  'https://theanalyst.com/competition/fcs-football/articles';

/**
 * WordPress REST API — category-filtered page 1 (15 posts on the live page).
 * Metadata source; ordering comes from the HTML page.
 */
export const THE_ANALYST_FCS_POSTS_URL = `https://theanalyst.com/wp-json/wp/v2/posts?categories=${THE_ANALYST_FCS_CATEGORY_ID}&per_page=15&_embed=author,wp:featuredmedia`;

export const THE_ANALYST_NEWS_SOURCE = 'The Analyst' as const;

export const THE_ANALYST_NEWS_FETCH_TIMEOUT_MS = 8_000;

/** Cache successful article lists for 20 minutes. */
export const THE_ANALYST_NEWS_CACHE_TTL_MS = 20 * 60_000;

export const THE_ANALYST_NEWS_CACHE_KEY = 'news:the-analyst';

export const THE_ANALYST_SITE_ORIGIN = 'https://theanalyst.com';
