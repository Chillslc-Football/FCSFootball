import {
  asString,
  decodeHtmlEntities,
  normalizePublicationDate,
  resolveAbsoluteUrl,
  stripHtml,
} from '@/data/news/newsUtils';

export type RssFeedItem = {
  title: string;
  url: string;
  publishedAt?: string;
  author?: string;
  excerpt?: string;
  imageUrl?: string;
  guid?: string;
};

function extractTaggedValue(block: string, tagName: string): string | undefined {
  const cdata = block.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`, 'i'),
  );
  if (cdata?.[1] != null) return cdata[1].trim();

  const plain = block.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>\\s*([\\s\\S]*?)\\s*</${tagName}>`, 'i'),
  );
  return plain?.[1]?.trim();
}

function extractLink(block: string): string | undefined {
  const fromTag = extractTaggedValue(block, 'link');
  if (fromTag && !fromTag.includes('<')) return fromTag;

  const atom = block.match(
    /<atom:link[^>]*href=["']([^"']+)["'][^>]*\/?>/i,
  );
  return atom?.[1]?.trim();
}

function extractImageUrl(block: string, siteOrigin?: string): string | undefined {
  const mediaContent = block.match(
    /<(?:media:content|media:thumbnail)[^>]*url=["']([^"']+)["'][^>]*\/?>/i,
  );
  if (mediaContent?.[1]) {
    return resolveAbsoluteUrl(mediaContent[1], siteOrigin ?? mediaContent[1]);
  }

  const enclosure = block.match(
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*(?:type=["']image\/[^"']*["'])?[^>]*\/?>/i,
  );
  if (enclosure?.[1]) {
    return resolveAbsoluteUrl(enclosure[1], siteOrigin ?? enclosure[1]);
  }

  const description = extractTaggedValue(block, 'description')
    ?? extractTaggedValue(block, 'content:encoded');
  if (!description) return undefined;

  const img = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!img?.[1]) return undefined;
  return resolveAbsoluteUrl(img[1], siteOrigin ?? img[1]);
}

/**
 * Minimal RSS 2.0 item parser. Source-agnostic on purpose — callers validate URLs.
 */
export function parseRssFeedItems(
  xml: string,
  options: { siteOrigin?: string } = {},
): RssFeedItem[] {
  const items: RssFeedItem[] = [];
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const rawTitle = extractTaggedValue(block, 'title');
    const title = rawTitle ? decodeHtmlEntities(rawTitle) : undefined;
    const rawUrl = extractLink(block);
    const absoluteUrl = rawUrl
      ? resolveAbsoluteUrl(rawUrl, options.siteOrigin ?? rawUrl)
      : undefined;

    if (!title || !absoluteUrl) continue;

    const rawDate =
      extractTaggedValue(block, 'pubDate')
      ?? extractTaggedValue(block, 'dc:date')
      ?? extractTaggedValue(block, 'published');
    const authorRaw =
      extractTaggedValue(block, 'dc:creator')
      ?? extractTaggedValue(block, 'author')
      ?? extractTaggedValue(block, 'creator');
    const descriptionRaw =
      extractTaggedValue(block, 'description')
      ?? extractTaggedValue(block, 'content:encoded');
    const excerpt = descriptionRaw ? stripHtml(descriptionRaw) : undefined;
    const guid = extractTaggedValue(block, 'guid');

    items.push({
      title,
      url: absoluteUrl,
      publishedAt: normalizePublicationDate(rawDate),
      author: authorRaw ? stripHtml(authorRaw) : undefined,
      excerpt: excerpt || undefined,
      imageUrl: extractImageUrl(block, options.siteOrigin),
      guid: asString(guid),
    });
  }

  return items;
}
