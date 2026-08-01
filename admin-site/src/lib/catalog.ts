export const PLATFORM_KEYS = [
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

export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
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

export const CONFERENCE_OPTIONS = [
  { id: 'big-sky', label: 'Big Sky' },
  { id: 'big-south-ovc', label: 'Big South-OVC' },
  { id: 'caa', label: 'CAA' },
  { id: 'fcs-independents', label: 'FCS Independents' },
  { id: 'ivy-league', label: 'Ivy League' },
  { id: 'meac', label: 'MEAC' },
  { id: 'mvfc', label: 'Missouri Valley Football Conference' },
  { id: 'nec', label: 'NEC' },
  { id: 'patriot', label: 'Patriot League' },
  { id: 'pioneer', label: 'Pioneer Football League' },
  { id: 'southern', label: 'Southern Conference' },
  { id: 'southland', label: 'Southland' },
  { id: 'swac', label: 'SWAC' },
  { id: 'united-athletic', label: 'United Athletic Conference' },
];

/** Starter team catalog; suggestions can add additional IDs via coverage labels. */
export const TEAM_OPTIONS = [
  { id: '147', label: 'Montana State' },
  { id: '149', label: 'Montana' },
];

export function emptyPlatformLinks(): Record<PlatformKey, string> {
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

export function normalizePlatformLinks(
  raw: Record<string, string> | null | undefined,
): Record<PlatformKey, string> {
  const out = emptyPlatformLinks();
  for (const key of PLATFORM_KEYS) {
    out[key] = typeof raw?.[key] === 'string' ? raw[key].trim() : '';
  }
  return out;
}

export function compactPlatformLinks(
  links: Record<PlatformKey, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PLATFORM_KEYS) {
    const value = links[key]?.trim();
    if (value) out[key] = value;
  }
  return out;
}

export type LinkRow = {
  id?: string;
  platform: PlatformKey;
  label: string;
  url: string;
  sortOrder: number;
};

export type LinkRowRpc = {
  platform: string;
  label: string | null;
  url: string;
  sort_order: number;
};

function isPlatformKey(value: string): value is PlatformKey {
  return (PLATFORM_KEYS as readonly string[]).includes(value);
}

export function emptyLinkRow(sortOrder = 0): LinkRow {
  return {
    platform: 'website',
    label: '',
    url: '',
    sortOrder,
  };
}

export function rowsFromPlatformLinks(
  raw: Record<string, string> | null | undefined,
): LinkRow[] {
  const rows: LinkRow[] = [];
  for (const key of PLATFORM_KEYS) {
    const url = typeof raw?.[key] === 'string' ? raw[key].trim() : '';
    if (!url) continue;
    rows.push({
      platform: key,
      label: '',
      url,
      sortOrder: rows.length,
    });
  }
  return rows;
}

/** Compact editor rows into the JSON array expected by admin RPCs (`sort_order`). */
export function compactLinkRows(rows: LinkRow[]): LinkRowRpc[] {
  return rows
    .filter((row) => row.url.trim())
    .map((row, index) => ({
      platform: row.platform,
      label: row.label.trim() || null,
      url: row.url.trim(),
      sort_order: index,
    }));
}

/** Parse API `links` array; fall back to legacy platformLinks object. */
export function parseLinkRows(
  links: unknown,
  platformLinks?: Record<string, string> | null,
): LinkRow[] {
  if (Array.isArray(links) && links.length > 0) {
    const rows: LinkRow[] = [];
    for (const item of links) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const platform = String(record.platform ?? '')
        .trim()
        .toLowerCase();
      const url = String(record.url ?? '').trim();
      if (!isPlatformKey(platform) || !url) continue;
      const label =
        typeof record.label === 'string' && record.label.trim() ? record.label.trim() : '';
      const sortOrder =
        typeof record.sortOrder === 'number'
          ? record.sortOrder
          : typeof record.sort_order === 'number'
            ? record.sort_order
            : rows.length;
      rows.push({
        id: typeof record.id === 'string' ? record.id : undefined,
        platform,
        label,
        url,
        sortOrder,
      });
    }
    return rows
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row, index) => ({ ...row, sortOrder: index }));
  }
  return rowsFromPlatformLinks(platformLinks);
}
