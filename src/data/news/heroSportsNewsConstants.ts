/** HERO Sports FCS category — verified via /wp-json/wp/v2/categories?search=fcs */
export const HERO_SPORTS_FCS_CATEGORY_ID = 28;

/** Official FCS category RSS — preferred structured source. */
export const HERO_SPORTS_FCS_RSS_URL = 'https://herosports.com/college-football/fcs/feed/';

/**
 * WordPress REST API — structured fallback / image enrichment.
 * Avoid `_embed` so cache-busting query params cannot alter WordPress routing.
 */
export const HERO_SPORTS_FCS_POSTS_URL = `https://herosports.com/wp-json/wp/v2/posts?categories=${HERO_SPORTS_FCS_CATEGORY_ID}&per_page=20&orderby=date&order=desc`;

export const HERO_SPORTS_NEWS_SOURCE = 'HERO Sports' as const;

export const HERO_SPORTS_NEWS_FETCH_TIMEOUT_MS = 15_000;

/** Cache successful article lists for 20 minutes. */
export const HERO_SPORTS_NEWS_CACHE_TTL_MS = 20 * 60_000;

export const HERO_SPORTS_NEWS_CACHE_KEY = 'fcsfootball.heroSportsNews.v1';

export const HERO_SPORTS_SITE_ORIGIN = 'https://herosports.com';

/** Soft minimum for sparse-feed warnings. */
export const HERO_SPORTS_NEWS_EXPECTED_MIN_ARTICLES = 5;
