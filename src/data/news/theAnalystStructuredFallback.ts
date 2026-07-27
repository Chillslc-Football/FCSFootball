import {
  asString,
  decodeHtmlEntities,
  isRecord,
  normalizeArticleUrl,
  normalizePublicationDate,
  resolveAbsoluteUrl,
} from '@/data/news/newsUtils';
import { THE_ANALYST_SITE_ORIGIN } from '@/data/news/theAnalystNewsConstants';

export type AnalystFallbackArticle = {
  title: string;
  url: string;
  publishedAt?: string;
  author?: string;
  excerpt?: string;
  imageUrl?: string;
};

const HOST_PATTERN = /(^|\.)theanalyst\.com$/i;
const ARTICLE_PATH_PATTERN = /^\/articles\/[^/]+\/?$/;

export function isValidTheAnalystArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      HOST_PATTERN.test(parsed.hostname) &&
      ARTICLE_PATH_PATTERN.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function normalizeCandidateUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const absolute = resolveAbsoluteUrl(raw, THE_ANALYST_SITE_ORIGIN);
  if (!absolute || !isValidTheAnalystArticleUrl(absolute)) return undefined;
  return absolute;
}

function upsert(
  map: Map<string, AnalystFallbackArticle>,
  article: AnalystFallbackArticle,
): void {
  const key = normalizeArticleUrl(article.url);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, article);
    return;
  }
  map.set(key, {
    ...existing,
    title: existing.title || article.title,
    publishedAt: existing.publishedAt || article.publishedAt,
    author: existing.author || article.author,
    excerpt: existing.excerpt || article.excerpt,
    imageUrl: existing.imageUrl || article.imageUrl,
  });
}

/** Prefer JSON-LD ItemList / Article nodes over CSS scraping. */
export function parseAnalystJsonLdArticles(html: string): AnalystFallbackArticle[] {
  const map = new Map<string, AnalystFallbackArticle>();
  const scriptPattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    const raw = scriptMatch[1]?.trim();
    if (!raw) continue;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      collectJsonLdNode(node, map);
    }
  }

  return [...map.values()];
}

function collectJsonLdNode(
  node: unknown,
  map: Map<string, AnalystFallbackArticle>,
): void {
  if (!isRecord(node)) return;

  const type = node['@type'];
  const types = Array.isArray(type) ? type.map(String) : type != null ? [String(type)] : [];

  if (types.includes('ItemList') && Array.isArray(node.itemListElement)) {
    for (const entry of node.itemListElement) {
      if (!isRecord(entry)) continue;
      const item = isRecord(entry.item) ? entry.item : entry;
      const url = normalizeCandidateUrl(asString(item.url) ?? asString(item['@id']));
      const title =
        asString(item.name) ?? asString(item.headline) ?? asString(entry.name);
      if (!url || !title) continue;
      upsert(map, {
        title: decodeHtmlEntities(title),
        url,
        publishedAt: normalizePublicationDate(
          asString(item.datePublished) ?? asString(item.dateCreated),
        ),
        author: asString(isRecord(item.author) ? item.author.name : item.author),
        imageUrl: normalizeImage(asString(isRecord(item.image) ? item.image.url : item.image)),
      });
    }
  }

  if (types.includes('Article') || types.includes('NewsArticle') || types.includes('BlogPosting')) {
    const url = normalizeCandidateUrl(asString(node.url) ?? asString(node.mainEntityOfPage));
    const title = asString(node.headline) ?? asString(node.name);
    if (url && title) {
      upsert(map, {
        title: decodeHtmlEntities(title),
        url,
        publishedAt: normalizePublicationDate(asString(node.datePublished)),
        author: asString(isRecord(node.author) ? node.author.name : node.author),
        imageUrl: normalizeImage(asString(isRecord(node.image) ? node.image.url : node.image)),
      });
    }
  }

  if (Array.isArray(node['@graph'])) {
    for (const child of node['@graph']) collectJsonLdNode(child, map);
  }
}

function normalizeImage(url?: string): string | undefined {
  if (!url) return undefined;
  const absolute = resolveAbsoluteUrl(url, THE_ANALYST_SITE_ORIGIN);
  if (!absolute) return undefined;
  try {
    const parsed = new URL(absolute);
    if (parsed.protocol !== 'https:' || !HOST_PATTERN.test(parsed.hostname)) return undefined;
    return absolute;
  } catch {
    return undefined;
  }
}

/**
 * Last-resort HTML parse with alternate selectors — not used when RSS/JSON succeed.
 * Requires title + URL; bad dates are omitted rather than rejecting the article.
 */
export function parseAnalystHtmlArticles(html: string): AnalystFallbackArticle[] {
  const map = new Map<string, AnalystFallbackArticle>();

  // Strategy 1: article/teaser/card containers with an internal article link + heading.
  const containerPattern =
    /<(?:article|div|li)[^>]*(?:class|data-type)=["'][^"']*(?:teaser|pg-card|article-card|post-card|story-card)[^"']*["'][^>]*>[\s\S]*?<\/(?:article|div|li)>/gi;

  let containerMatch: RegExpExecArray | null;
  while ((containerMatch = containerPattern.exec(html)) !== null) {
    const block = containerMatch[0];
    const href =
      block.match(
        /href=["']((?:https:\/\/theanalyst\.com)?\/articles\/[^"'#?\s]+)["']/i,
      )?.[1] ??
      block.match(
        /href=["'](https:\/\/theanalyst\.com\/articles\/[^"'#?\s]+)["']/i,
      )?.[1];
    const url = normalizeCandidateUrl(href);
    if (!url) continue;

    const titleRaw =
      block.match(
        /<(?:h1|h2|h3|h4)[^>]*>\s*(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/(?:h1|h2|h3|h4)>/i,
      )?.[1] ??
      block.match(
        /(?:teaser-title|pg-card__title|card-title|article-title)[^>]*>\s*(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?/i,
      )?.[1];
    const title = titleRaw ? decodeHtmlEntities(titleRaw) : undefined;
    if (!title) continue;

    const publishedAt = normalizePublicationDate(
      block.match(/datetime=["']([^"']+)["']/i)?.[1]
        ?? block.match(/<time[^>]*>\s*([^<]+?)\s*<\/time>/i)?.[1],
    );
    const author =
      asString(
        block.match(
          /(?:pg-card__author|class=["']author["']|rel=["']author["'])[^>]*>([^<]+)/i,
        )?.[1],
      ) ?? undefined;
    const excerptRaw = block.match(
      /(?:teaser-summary|pg-card__summary|card-summary|excerpt)[^>]*>\s*([\s\S]*?)\s*<\/p>/i,
    )?.[1];
    const imageUrl = normalizeImage(
      block.match(/src=["'](https:\/\/theanalyst\.com\/wp-content\/uploads\/[^"']+)["']/i)?.[1]
        ?? block.match(/src=["'](\/wp-content\/uploads\/[^"']+)["']/i)?.[1],
    );

    upsert(map, {
      title,
      url,
      publishedAt,
      author,
      excerpt: excerptRaw ? decodeHtmlEntities(excerptRaw) : undefined,
      imageUrl,
    });
  }

  // Strategy 2: bare article links with nearby heading text (broader catch-all).
  if (map.size === 0) {
    const linkPattern =
      /<a[^>]+href=["']((?:https:\/\/theanalyst\.com)?\/articles\/[^"'#?\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const url = normalizeCandidateUrl(linkMatch[1]);
      const title = decodeHtmlEntities(linkMatch[2] ?? '');
      if (!url || !title || title.length < 8) continue;
      if (/^https?:\/\//i.test(title)) continue;
      upsert(map, { title, url });
    }
  }

  return [...map.values()];
}

/** Structured-first page parse: JSON-LD, then resilient HTML. */
export function parseAnalystPageFallbackArticles(html: string): AnalystFallbackArticle[] {
  const fromJsonLd = parseAnalystJsonLdArticles(html);
  if (fromJsonLd.length > 0) return fromJsonLd;
  return parseAnalystHtmlArticles(html);
}
