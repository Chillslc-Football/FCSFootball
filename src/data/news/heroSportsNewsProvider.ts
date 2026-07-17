import {
  HERO_SPORTS_FCS_POSTS_URL,
  HERO_SPORTS_NEWS_FETCH_TIMEOUT_MS,
  HERO_SPORTS_NEWS_SOURCE,
} from '@/data/news/heroSportsNewsConstants';
import type { NewsArticle, NewsArticlesPayload } from '@/types/news';

const HERO_SPORTS_HOST_PATTERN = /(^|\.)herosports\.com$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return undefined;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidHeroSportsArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && HERO_SPORTS_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

function parseFeaturedImageUrl(post: Record<string, unknown>): string | undefined {
  const embedded = post._embedded;
  if (!isRecord(embedded)) return undefined;

  const featured = embedded['wp:featuredmedia'];
  if (!Array.isArray(featured) || !isRecord(featured[0])) return undefined;

  const sourceUrl = asString(featured[0].source_url);
  if (!sourceUrl || !sourceUrl.startsWith('https://')) return undefined;

  return sourceUrl;
}

function parseAuthorName(post: Record<string, unknown>): string | undefined {
  const embedded = post._embedded;
  if (!isRecord(embedded)) return undefined;

  const authors = embedded.author;
  if (!Array.isArray(authors) || !isRecord(authors[0])) return undefined;

  return asString(authors[0].name);
}

function parseRenderedField(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isRecord(value)) return asString(value.rendered);
  return undefined;
}

function parseWordPressPost(post: unknown): NewsArticle | null {
  if (!isRecord(post)) return null;

  const id = asString(post.id);
  const link = asString(post.link);
  const titleHtml = parseRenderedField(post.title);
  const title = titleHtml ? stripHtml(titleHtml) : undefined;
  const publishedAt = asString(post.date);

  if (!id || !link || !title || !isValidHeroSportsArticleUrl(link)) {
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
    source: HERO_SPORTS_NEWS_SOURCE,
  };
}

function dedupeArticlesByUrl(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const result: NewsArticle[] = [];

  for (const article of articles) {
    const key = article.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
}

export async function fetchHeroSportsFcsNews(
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<NewsArticlesPayload> {
  const timeoutMs = options.timeoutMs ?? HERO_SPORTS_NEWS_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(HERO_SPORTS_FCS_POSTS_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FCSFootball/1.0 (Expo; FCS News Reader)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HERO Sports news request failed (${response.status}).`);
    }

    const raw = (await response.json()) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error('HERO Sports news response was not a JSON array.');
    }

    const articles = dedupeArticlesByUrl(
      raw
        .map((post) => parseWordPressPost(post))
        .filter((article): article is NewsArticle => article != null),
    );

    return {
      articles,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`HERO Sports news request timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw err instanceof Error ? err : new Error('HERO Sports news request failed.');
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onAbort);
  }
}
