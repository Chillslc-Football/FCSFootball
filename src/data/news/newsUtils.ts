import type { NewsArticle } from '@/types/news';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return undefined;
}

export function stripHtml(value: string): string {
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

export function decodeHtmlEntities(value: string): string {
  return stripHtml(value.replace(/<[^>]+>/g, ' '));
}

export function parseRenderedField(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isRecord(value)) return asString(value.rendered);
  return undefined;
}

export function normalizeArticleUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    let normalized = parsed.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function dedupeArticlesByUrl(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const result: NewsArticle[] = [];

  for (const article of articles) {
    const key = normalizeArticleUrl(article.url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
}

/** Parse article publication timestamps; invalid/missing dates sort last. */
export function articlePublishedAtMs(article: NewsArticle): number {
  if (!article.publishedAt) return Number.NaN;
  const ms = Date.parse(article.publishedAt);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

/** Newest first by publication date. Preserves relative order for equal/missing dates. */
export function sortArticlesByPublishedAtDesc(articles: readonly NewsArticle[]): NewsArticle[] {
  return articles
    .map((article, index) => ({ article, index, publishedMs: articlePublishedAtMs(article) }))
    .sort((a, b) => {
      const aValid = Number.isFinite(a.publishedMs);
      const bValid = Number.isFinite(b.publishedMs);
      if (aValid && bValid && a.publishedMs !== b.publishedMs) {
        return b.publishedMs - a.publishedMs;
      }
      if (aValid !== bValid) return aValid ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ article }) => article);
}

/**
 * Append a cache-buster without re-serializing the full query string.
 * Important: `URLSearchParams` / `URL#toString()` re-encodes values like
 * `_embed=author,wp:featuredmedia` into `%2C` / `%3A`, which crashes some WP hosts.
 */
export function withCacheBust(url: string, bustValue: string | number = Date.now()): string {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}_ts=${encodeURIComponent(String(bustValue))}`;
}

/**
 * Normalize assorted publication date strings to ISO-8601 when possible.
 * Returns undefined for unparseable values — callers must not drop the article.
 */
export function normalizePublicationDate(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const direct = Date.parse(trimmed);
  if (Number.isFinite(direct)) {
    return new Date(direct).toISOString();
  }

  // WordPress local/gmt without timezone: treat as UTC.
  const wpNaive = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/,
  );
  if (wpNaive) {
    const ms = Date.parse(`${wpNaive[1]}T${wpNaive[2]}Z`);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }

  return undefined;
}

/** Prefer WordPress GMT publish time so newest-first sorting is timezone-stable. */
export function parseWordPressPublishedAt(post: Record<string, unknown>): string | undefined {
  const dateGmt = asString(post.date_gmt);
  if (dateGmt) {
    return normalizePublicationDate(
      /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateGmt) ? dateGmt : `${dateGmt}Z`,
    );
  }
  return normalizePublicationDate(asString(post.date));
}

/** Dev-only warning when a structured parser returns an unexpectedly small set. */
export function warnIfSparseArticleCount(
  source: string,
  articleCount: number,
  expectedMin: number,
  details?: string,
): void {
  if (!__DEV__) return;
  if (articleCount === 0) {
    console.warn(`[News:${source}] parser returned zero articles.`, details ?? '');
    return;
  }
  if (articleCount < expectedMin) {
    console.warn(
      `[News:${source}] parser returned only ${articleCount} articles (expected at least ${expectedMin}).`,
      details ?? '',
    );
  }
}

export function parseYoastImageUrl(post: Record<string, unknown>): string | undefined {
  const yoast = post.yoast_head_json;
  if (!isRecord(yoast)) return undefined;
  const ogImage = yoast.og_image;
  if (!Array.isArray(ogImage) || !isRecord(ogImage[0])) return undefined;
  const url = asString(ogImage[0].url);
  return url?.startsWith('https://') ? url : undefined;
}

export function parseYoastAuthorName(post: Record<string, unknown>): string | undefined {
  const yoast = post.yoast_head_json;
  if (!isRecord(yoast)) return undefined;
  return asString(yoast.author);
}

/** Best-effort body snippet for failed HTTP responses (dev diagnostics). */
export async function readErrorResponseDetails(response: Response): Promise<string> {
  try {
    const text = await response.clone().text();
    const trimmed = text.trim();
    if (!trimmed) return `(empty body, status ${response.status})`;
    try {
      const json = JSON.parse(trimmed) as unknown;
      if (isRecord(json)) {
        const code = asString(json.code);
        const message = asString(json.message)?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return [code, message].filter(Boolean).join(': ') || trimmed.slice(0, 400);
      }
    } catch {
      // non-JSON body
    }
    return trimmed.slice(0, 400);
  } catch {
    return `(unable to read body, status ${response.status})`;
  }
}

export function resolveAbsoluteUrl(url: string, baseUrl: string): string | undefined {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export async function fetchWithTimeout(
  url: string,
  options: {
    signal?: AbortSignal;
    timeoutMs: number;
    headers?: Record<string, string>;
    accept?: string;
    /** When true (default), bypass HTTP caches that may serve week-old HTML/API bodies. */
    bypassHttpCache?: boolean;
  },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  const bypassHttpCache = options.bypassHttpCache !== false;
  const requestUrl = bypassHttpCache ? withCacheBust(url) : url;

  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    return await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: options.accept ?? 'application/json',
        'User-Agent': 'FCSFootball/1.0 (Expo; FCS News Reader)',
        ...(bypassHttpCache
          ? {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            }
          : null),
        ...options.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export function logNewsFetchDev(details: {
  source: string;
  phase: 'start' | 'success' | 'error' | 'stale-fallback';
  endpoint?: string;
  requestStartedAt?: string;
  status?: number;
  articleCount?: number;
  newestTitle?: string;
  newestUrl?: string;
  newestPublishedAt?: string;
  error?: unknown;
  responseDetails?: string;
}): void {
  if (!__DEV__) return;

  const prefix = `[News:${details.source}]`;
  if (details.phase === 'start') {
    console.log(`${prefix} request begin`, {
      endpoint: details.endpoint,
      requestStartedAt: details.requestStartedAt ?? new Date().toISOString(),
    });
    return;
  }
  if (details.phase === 'success') {
    console.log(`${prefix} success`, {
      endpoint: details.endpoint,
      requestStartedAt: details.requestStartedAt,
      status: details.status,
      articleCount: details.articleCount,
      newestTitle: details.newestTitle,
      newestUrl: details.newestUrl,
      newestPublishedAt: details.newestPublishedAt,
    });
    return;
  }
  if (details.phase === 'stale-fallback') {
    console.warn(`${prefix} serving previously cached articles (stale) after live failure`, {
      articleCount: details.articleCount,
      error: details.error instanceof Error ? details.error.message : details.error,
      responseDetails: details.responseDetails,
    });
    return;
  }
  console.warn(`${prefix} request failed`, {
    endpoint: details.endpoint,
    requestStartedAt: details.requestStartedAt,
    status: details.status,
    error: details.error instanceof Error ? details.error.message : details.error,
    responseDetails: details.responseDetails,
  });
}
