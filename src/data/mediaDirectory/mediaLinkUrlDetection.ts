/**
 * URL normalization + platform detection for Suggest FCS Media link cards.
 */

import {
  MEDIA_PLATFORM_LINK_LABELS,
  type MediaPlatformLinkKey,
} from '@/data/mediaDirectory/mediaPlatformLinks';

const SPECIFIC_PLATFORMS = new Set<MediaPlatformLinkKey>([
  'youtube',
  'spotify',
  'apple',
  'x',
  'facebook',
  'instagram',
  'rss',
]);

/** True when a platform is a known social/media host (not Website/Other). */
export function isSpecificMediaPlatform(platform: string | null | undefined): boolean {
  const key = String(platform ?? '').trim().toLowerCase();
  return SPECIFIC_PLATFORMS.has(key as MediaPlatformLinkKey);
}

/** True when a scheme-less value looks like host.tld[/path] (safe to prefix https://). */
function looksLikeHostPath(value: string): boolean {
  if (/^localhost([/:?#].*)?$/i.test(value)) return true;
  // Require a dot + TLD-ish segment so bare words like "not-a-url" stay invalid.
  return /^[a-z0-9][a-z0-9.-]*\.[a-z0-9.-]*[a-z]{2,}([/:?#].*)?$/i.test(value);
}

/**
 * Normalize user-entered URLs for validation/submit.
 * Adds https:// when the scheme is omitted on host-like values.
 * Does not rewrite while typing.
 */
export function normalizeSuggestLinkUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  // Leave other schemes alone (mailto:, ftp:, etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;

  if (looksLikeHostPath(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/** Hostname used to decide whether a URL change is "substantial". */
export function getSuggestLinkUrlHostKey(raw: string): string {
  const normalized = normalizeSuggestLinkUrl(raw);
  if (!normalized) return '';
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return normalized.toLowerCase();
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Detect platform from hostname/path.
 * Unknown http(s) domains → Website (never Other).
 * Returns null when the value cannot be parsed as an http(s) URL.
 */
export function detectMediaPlatformFromUrl(raw: string): MediaPlatformLinkKey | null {
  const normalized = normalizeSuggestLinkUrl(raw);
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname.toLowerCase();

  if (host === 'youtu.be' || hostMatches(host, 'youtube.com')) return 'youtube';
  if (hostMatches(host, 'spotify.com')) return 'spotify';
  if (host === 'podcasts.apple.com') return 'apple';
  if (host === 'x.com' || hostMatches(host, 'twitter.com')) return 'x';
  if (host === 'fb.com' || hostMatches(host, 'facebook.com')) return 'facebook';
  if (hostMatches(host, 'instagram.com')) return 'instagram';

  if (
    path.endsWith('.xml') ||
    path.endsWith('.rss') ||
    path.endsWith('/feed') ||
    path.endsWith('/rss') ||
    path.includes('/feed/') ||
    path.includes('/rss/') ||
    path.includes('/atom') ||
    /(^|\/)(feed|rss|atom)(\/|$)/.test(path)
  ) {
    return 'rss';
  }

  return 'website';
}

/**
 * When both the selected platform and URL map to different specific platforms,
 * return a field error. Website/Other overrides are allowed.
 */
export function getMediaPlatformUrlMismatchError(
  platform: string | null | undefined,
  rawUrl: string,
): string | null {
  const selected = String(platform ?? '').trim().toLowerCase() as MediaPlatformLinkKey;
  const detected = detectMediaPlatformFromUrl(rawUrl);
  if (!detected) return null;
  if (!isSpecificMediaPlatform(selected) || !isSpecificMediaPlatform(detected)) {
    return null;
  }
  if (selected === detected) return null;
  const detectedLabel = MEDIA_PLATFORM_LINK_LABELS[detected];
  return `This URL looks like ${detectedLabel}. Choose ${detectedLabel} or change the URL.`;
}
