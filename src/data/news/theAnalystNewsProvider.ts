import {
  THE_ANALYST_FCS_PAGE_URL,
  THE_ANALYST_FCS_POSTS_URL,
  THE_ANALYST_NEWS_FETCH_TIMEOUT_MS,
  THE_ANALYST_NEWS_SOURCE,
  THE_ANALYST_SITE_ORIGIN,
} from '@/data/news/theAnalystNewsConstants';
import {
  asString,
  decodeHtmlEntities,
  dedupeArticlesByUrl,
  fetchWithTimeout,
  isRecord,
  normalizeArticleUrl,
  parseRenderedField,
  resolveAbsoluteUrl,
  stripHtml,
} from '@/data/news/newsUtils';
import type { NewsArticle, NewsArticlesPayload } from '@/types/news';

const THE_ANALYST_HOST_PATTERN = /(^|\.)theanalyst\.com$/i;
const THE_ANALYST_ARTICLE_PATH_PATTERN = /^\/articles\/[^/]+\/?$/;

export function isValidTheAnalystArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      THE_ANALYST_HOST_PATTERN.test(parsed.hostname) &&
      THE_ANALYST_ARTICLE_PATH_PATTERN.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function isAllowedTheAnalystImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && THE_ANALYST_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

function parseFeaturedImageUrl(post: Record<string, unknown>): string | undefined {
  const embedded = post._embedded;
  if (!isRecord(embedded)) return undefined;

  const featured = embedded['wp:featuredmedia'];
  if (!Array.isArray(featured) || !isRecord(featured[0])) return undefined;

  const media = featured[0];
  const sizes = isRecord(media.media_details) ? media.media_details.sizes : undefined;
  if (isRecord(sizes)) {
    for (const key of ['medium_large', 'large', 'medium', 'thumbnail'] as const) {
      const size = sizes[key];
      if (isRecord(size)) {
        const sourceUrl = asString(size.source_url);
        if (sourceUrl && isAllowedTheAnalystImageUrl(sourceUrl)) {
          return sourceUrl;
        }
      }
    }
  }

  const sourceUrl = asString(media.source_url);
  if (sourceUrl && isAllowedTheAnalystImageUrl(sourceUrl)) {
    return sourceUrl;
  }

  return undefined;
}

function parseAuthorName(post: Record<string, unknown>): string | undefined {
  const embedded = post._embedded;
  if (!isRecord(embedded)) return undefined;

  const authors = embedded.author;
  if (!Array.isArray(authors) || !isRecord(authors[0])) return undefined;

  return asString(authors[0].name);
}

function parseWordPressPost(post: unknown): NewsArticle | null {
  if (!isRecord(post)) return null;

  const id = asString(post.id);
  const link = asString(post.link);
  const titleHtml = parseRenderedField(post.title);
  const title = titleHtml ? stripHtml(titleHtml) : undefined;
  const publishedAt = asString(post.date);

  if (!id || !link || !title || !isValidTheAnalystArticleUrl(link)) {
    return null;
  }

  const excerptHtml = parseRenderedField(post.excerpt);
  const excerpt = excerptHtml ? stripHtml(excerptHtml) : undefined;
  const imageUrl = parseFeaturedImageUrl(post);
  const author = parseAuthorName(post);

  return {
    id,
    title,
    url: link,
    imageUrl,
    author,
    publishedAt,
    excerpt: excerpt || undefined,
    source: THE_ANALYST_NEWS_SOURCE,
  };
}

type ParsedHtmlCard = {
  url: string;
  title?: string;
  excerpt?: string;
  author?: string;
  publishedAt?: string;
  imageUrl?: string;
};

function parseFeaturedArticleUrls(html: string): string[] {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) return [];

  try {
    const data = JSON.parse(match[1]) as unknown;
    if (!isRecord(data) || data['@type'] !== 'ItemList' || data.name !== 'Featured Articles') {
      return [];
    }

    const items = data.itemListElement;
    if (!Array.isArray(items)) return [];

    const urls: string[] = [];
    for (const entry of items) {
      if (!isRecord(entry) || !isRecord(entry.item)) continue;
      const url = asString(entry.item.url);
      if (url && isValidTheAnalystArticleUrl(url)) {
        urls.push(url);
      }
    }
    return urls;
  } catch {
    return [];
  }
}

function parsePageOneTeaserUrls(html: string): string[] {
  const featuredIndex = html.indexOf('Featured Articles');
  const paginationIndex = html.indexOf('class="pagination');
  if (featuredIndex < 0 || paginationIndex < 0 || paginationIndex <= featuredIndex) {
    return [];
  }

  const listSection = html.slice(featuredIndex, paginationIndex);
  const pattern =
    /<article class="[^"]*teaser-type--post[^"]*"[\s\S]*?teaser-content-link" href="(https:\/\/theanalyst\.com\/articles\/[^"]+)"/g;

  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(listSection)) !== null) {
    const url = match[1];
    if (isValidTheAnalystArticleUrl(url)) {
      urls.push(url);
    }
  }

  return urls;
}

function parseHtmlCardFallbacks(html: string): Map<string, ParsedHtmlCard> {
  const cards = new Map<string, ParsedHtmlCard>();

  const pgCardPattern =
    /<article class="pg-card[^"]*" id="pg-card-(\d+)"[\s\S]*?pg-card__title-link" href="(https:\/\/theanalyst\.com\/articles\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:pg-card__summary">([\s\S]*?)<\/p>)?[\s\S]*?datetime="([^"]+)"[\s\S]*?(?:pg-card__author"[^>]*>([^<]*)<)?[\s\S]*?(?:src="(https:\/\/theanalyst\.com\/wp-content\/uploads\/[^"]+)")?/g;

  let match: RegExpExecArray | null;
  while ((match = pgCardPattern.exec(html)) !== null) {
    const url = match[2];
    if (!isValidTheAnalystArticleUrl(url)) continue;

    cards.set(normalizeArticleUrl(url), {
      url,
      title: match[3] ? decodeHtmlEntities(match[3]) : undefined,
      excerpt: match[4] ? decodeHtmlEntities(match[4]) : undefined,
      publishedAt: asString(match[5]),
      author: asString(match[6]),
      imageUrl: asString(match[7]),
    });
  }

  const teaserPattern =
    /<article class="[^"]*teaser-type--post[^"]*" id="tease-(\d+)"[\s\S]*?teaser-content-link" href="(https:\/\/theanalyst\.com\/articles\/[^"]+)"[\s\S]*?teaser-title">([\s\S]*?)<\/h3>[\s\S]*?(?:teaser-summary">([\s\S]*?)<\/p>)?[\s\S]*?datetime="([^"]+)"[\s\S]*?class="author"[^>]*>([^<]*)<[\s\S]*?(?:src="(https:\/\/theanalyst\.com\/wp-content\/uploads\/[^"]+)")?/g;

  while ((match = teaserPattern.exec(html)) !== null) {
    const url = match[2];
    if (!isValidTheAnalystArticleUrl(url)) continue;

    cards.set(normalizeArticleUrl(url), {
      url,
      title: decodeHtmlEntities(match[3]),
      excerpt: match[4] ? decodeHtmlEntities(match[4]) : undefined,
      publishedAt: asString(match[5]),
      author: asString(match[6]),
      imageUrl: asString(match[7]),
    });
  }

  return cards;
}

function buildOrderedPageOneUrls(html: string): string[] {
  const featuredUrls = parseFeaturedArticleUrls(html);
  const teaserUrls = parsePageOneTeaserUrls(html);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const url of [...featuredUrls, ...teaserUrls]) {
    const key = normalizeArticleUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(url);
  }

  return ordered;
}

function mapPostsByUrl(posts: NewsArticle[]): Map<string, NewsArticle> {
  const map = new Map<string, NewsArticle>();
  for (const post of posts) {
    map.set(normalizeArticleUrl(post.url), post);
  }
  return map;
}

function mergeArticleWithFallback(
  article: NewsArticle | undefined,
  fallback: ParsedHtmlCard | undefined,
  url: string,
): NewsArticle | null {
  const normalizedUrl = resolveAbsoluteUrl(url, THE_ANALYST_SITE_ORIGIN);
  if (!normalizedUrl || !isValidTheAnalystArticleUrl(normalizedUrl)) {
    return null;
  }

  if (article) {
    return {
      ...article,
      url: normalizedUrl,
      title: article.title || fallback?.title || '',
      excerpt: article.excerpt || fallback?.excerpt,
      author: article.author || fallback?.author,
      publishedAt: article.publishedAt || fallback?.publishedAt,
      imageUrl:
        article.imageUrl ||
        (fallback?.imageUrl && isAllowedTheAnalystImageUrl(fallback.imageUrl)
          ? fallback.imageUrl
          : undefined),
    };
  }

  if (!fallback?.title) return null;

  const idMatch = normalizedUrl.match(/\/articles\/([^/?#]+)/);
  const id = idMatch?.[1] ?? normalizeArticleUrl(normalizedUrl);

  return {
    id,
    title: fallback.title,
    url: normalizedUrl,
    excerpt: fallback.excerpt,
    author: fallback.author,
    publishedAt: fallback.publishedAt,
    imageUrl:
      fallback.imageUrl && isAllowedTheAnalystImageUrl(fallback.imageUrl)
        ? fallback.imageUrl
        : undefined,
    source: THE_ANALYST_NEWS_SOURCE,
  };
}

export async function fetchTheAnalystFcsNews(
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<NewsArticlesPayload> {
  const timeoutMs = options.timeoutMs ?? THE_ANALYST_NEWS_FETCH_TIMEOUT_MS;

  try {
    const [pageResponse, postsResponse] = await Promise.all([
      fetchWithTimeout(THE_ANALYST_FCS_PAGE_URL, {
        signal: options.signal,
        timeoutMs,
        accept: 'text/html,application/xhtml+xml',
      }),
      fetchWithTimeout(THE_ANALYST_FCS_POSTS_URL, {
        signal: options.signal,
        timeoutMs,
        accept: 'application/json',
      }),
    ]);

    if (!pageResponse.ok) {
      throw new Error(`The Analyst page request failed (${pageResponse.status}).`);
    }
    if (!postsResponse.ok) {
      throw new Error(`The Analyst news request failed (${postsResponse.status}).`);
    }

    const html = await pageResponse.text();
    const raw = (await postsResponse.json()) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error('The Analyst news response was not a JSON array.');
    }

    const orderedUrls = buildOrderedPageOneUrls(html);
    if (orderedUrls.length === 0) {
      throw new Error('The Analyst page-one articles could not be parsed.');
    }

    const postsByUrl = mapPostsByUrl(
      raw
        .map((post) => parseWordPressPost(post))
        .filter((article): article is NewsArticle => article != null),
    );
    const htmlFallbacks = parseHtmlCardFallbacks(html);

    const articles = dedupeArticlesByUrl(
      orderedUrls
        .map((url) =>
          mergeArticleWithFallback(
            postsByUrl.get(normalizeArticleUrl(url)),
            htmlFallbacks.get(normalizeArticleUrl(url)),
            url,
          ),
        )
        .filter((article): article is NewsArticle => article != null && Boolean(article.title)),
    );

    return {
      articles,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`The Analyst news request timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw err instanceof Error ? err : new Error('The Analyst news request failed.');
  }
}
