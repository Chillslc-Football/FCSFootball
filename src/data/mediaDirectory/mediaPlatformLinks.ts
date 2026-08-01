/** Platform link keys stored in media_suggestions.platform_links jsonb. */
export const MEDIA_PLATFORM_LINK_KEYS = [
  'website',
  'spotify',
  'apple',
  'youtube',
  'x',
  'facebook',
  'instagram',
  'rss',
  'other',
] as const;

export type MediaPlatformLinkKey = (typeof MEDIA_PLATFORM_LINK_KEYS)[number];

export type MediaPlatformLinks = Partial<Record<MediaPlatformLinkKey, string>>;

export const MEDIA_PLATFORM_LINK_LABELS: Record<MediaPlatformLinkKey, string> = {
  website: 'Website',
  spotify: 'Spotify',
  apple: 'Apple Podcasts',
  youtube: 'YouTube',
  x: 'X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  rss: 'RSS Feed',
  other: 'Other Link',
};

export const MEDIA_PLATFORM_LINK_PLACEHOLDERS: Record<MediaPlatformLinkKey, string> = {
  website: 'https://example.com',
  spotify: 'https://open.spotify.com/...',
  apple: 'https://podcasts.apple.com/...',
  youtube: 'https://youtube.com/...',
  x: 'https://x.com/...',
  facebook: 'https://facebook.com/...',
  instagram: 'https://instagram.com/...',
  rss: 'https://example.com/feed.xml',
  other: 'https://...',
};

/** Field-specific invalid-URL copy shown under each Platform Links input. */
export const MEDIA_PLATFORM_LINK_FIELD_ERRORS: Record<MediaPlatformLinkKey, string> = {
  website: 'Enter a valid website URL.',
  spotify: 'Enter a valid Spotify URL.',
  apple: 'Enter a valid Apple Podcasts URL.',
  youtube: 'Enter a valid YouTube URL.',
  x: 'Enter a valid X URL.',
  facebook: 'Enter a valid Facebook URL.',
  instagram: 'Enter a valid Instagram URL.',
  rss: 'Enter a valid RSS feed URL.',
  other: 'Enter a valid URL.',
};

/** Primary fields shown above “More Links”. */
export const MEDIA_PLATFORM_LINK_PRIMARY_KEYS: MediaPlatformLinkKey[] = [
  'website',
  'spotify',
  'apple',
  'youtube',
];

/** Fields under the expandable “More Links” section. */
export const MEDIA_PLATFORM_LINK_MORE_KEYS: MediaPlatformLinkKey[] = [
  'x',
  'facebook',
  'instagram',
  'rss',
  'other',
];

export function createEmptyMediaPlatformLinks(): Record<MediaPlatformLinkKey, string> {
  return {
    website: '',
    spotify: '',
    apple: '',
    youtube: '',
    x: '',
    facebook: '',
    instagram: '',
    rss: '',
    other: '',
  };
}

/** Trim and drop blank values — only populated keys remain. */
export function normalizeMediaPlatformLinks(
  input: Partial<Record<MediaPlatformLinkKey, string | null | undefined>> | null | undefined,
): MediaPlatformLinks {
  const out: MediaPlatformLinks = {};
  for (const key of MEDIA_PLATFORM_LINK_KEYS) {
    const value = input?.[key]?.trim();
    if (value) out[key] = value;
  }
  return out;
}

export function countMediaPlatformLinks(links: MediaPlatformLinks): number {
  return Object.keys(links).length;
}

/** First populated link in preferred order — for legacy provider / submitted_url columns. */
export function getPrimaryMediaPlatformLink(
  links: MediaPlatformLinks,
): { key: MediaPlatformLinkKey; url: string } | null {
  for (const key of MEDIA_PLATFORM_LINK_KEYS) {
    const url = links[key]?.trim();
    if (url) return { key, url };
  }
  return null;
}

/** Plain-text block for owner notification emails. */
export function formatMediaPlatformLinksForEmail(links: MediaPlatformLinks): string {
  const lines: string[] = [];
  for (const key of MEDIA_PLATFORM_LINK_KEYS) {
    const url = links[key]?.trim();
    if (!url) continue;
    lines.push(`${MEDIA_PLATFORM_LINK_LABELS[key]}: ${url}`);
  }
  if (lines.length === 0) return 'None provided';
  return ['Platform Links', ...lines].join('\n');
}
