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
  },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Accept: options.accept ?? 'application/json',
        'User-Agent': 'FCSFootball/1.0 (Expo; FCS News Reader)',
        ...options.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onAbort);
  }
}
