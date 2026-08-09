/**
 * Repeatable media links (multiple URLs per platform, optional labels).
 * Phase 3: each link carries its own multi-select coverage.
 */

import {
  cloneMediaBrowseFilter,
  coverageToMediaBrowseFilter,
  createEmptyMediaBrowseFilter,
  isMediaBrowseFilterActive,
  mediaBrowseFilterToCoverage,
  type MediaBrowseFilter,
} from '@/data/mediaDirectory/mediaBrowse';
import {
  getMediaPlatformUrlMismatchError,
  normalizeSuggestLinkUrl,
} from '@/data/mediaDirectory/mediaLinkUrlDetection';
import {
  MEDIA_PLATFORM_LINK_KEYS,
  MEDIA_PLATFORM_LINK_LABELS,
  type MediaPlatformLinkKey,
  type MediaPlatformLinks,
} from '@/data/mediaDirectory/mediaPlatformLinks';

export type MediaLinkRow = {
  id?: string | null;
  platform: MediaPlatformLinkKey;
  label: string | null;
  url: string;
  sortOrder: number;
  /** Present on suggestion submit / Phase 2+ API rows; optional on older listings. */
  isNational?: boolean;
  teamIds?: string[];
  conferenceIds?: string[];
};

export type MediaLinkRowInput = {
  id?: string | null;
  platform?: string | null;
  label?: string | null;
  url?: string | null;
  sortOrder?: number | null;
  /**
   * When true, Suggest UI keeps the user's manual platform choice until the
   * URL host changes substantially.
   */
  platformManual?: boolean | null;
  /** Host key captured when the user last manually chose a platform. */
  platformManualHostKey?: string | null;
  /** Preferred form/editor coverage state (independent per link). */
  coverage?: MediaBrowseFilter | null;
  isNational?: boolean | null;
  teamIds?: string[] | null;
  conferenceIds?: string[] | null;
  teamLabels?: Record<string, string> | null;
  conferenceLabels?: Record<string, string> | null;
};

export function isMediaPlatformLinkKey(value: string): value is MediaPlatformLinkKey {
  return (MEDIA_PLATFORM_LINK_KEYS as readonly string[]).includes(value);
}

export function normalizeMediaLinkUrl(raw: string): string {
  return raw.trim();
}

/** Compare URLs for exact-duplicate detection within one creator/suggestion. */
export function mediaLinkUrlKey(raw: string): string {
  return normalizeSuggestLinkUrl(normalizeMediaLinkUrl(raw))
    .toLowerCase()
    .replace(/\/+$/, '');
}

/** Resolve browse filter for a draft link (coverage object or flat ids). */
export function getMediaLinkRowBrowseFilter(row: MediaLinkRowInput): MediaBrowseFilter {
  if (row.coverage) {
    return cloneMediaBrowseFilter(row.coverage);
  }
  return coverageToMediaBrowseFilter({
    isNational: Boolean(row.isNational),
    teamIds: row.teamIds ?? [],
    conferenceIds: row.conferenceIds ?? [],
    teamLabels: row.teamLabels,
    conferenceLabels: row.conferenceLabels,
  });
}

export function mediaLinkRowHasCoverage(row: MediaLinkRowInput): boolean {
  return isMediaBrowseFilterActive(getMediaLinkRowBrowseFilter(row));
}

export function createEmptyMediaLinkRow(
  sortOrder = 0,
  inheritCoverageFrom?: MediaBrowseFilter | null,
): MediaLinkRowInput {
  return {
    platform: 'website',
    label: '',
    url: '',
    sortOrder,
    platformManual: false,
    platformManualHostKey: null,
    coverage: inheritCoverageFrom
      ? cloneMediaBrowseFilter(inheritCoverageFrom)
      : createEmptyMediaBrowseFilter(),
  };
}

export function isMediaLinkRowBlank(row: MediaLinkRowInput): boolean {
  return !row.url?.trim() && !row.label?.trim();
}

export type MediaLinkRowsValidationResult =
  | { ok: true; value: MediaLinkRow[] }
  | {
      ok: false;
      error: string;
      fieldErrors: Record<string, string>;
    };

export function validateMediaLinkRows(
  rows: MediaLinkRowInput[] | null | undefined,
): MediaLinkRowsValidationResult {
  const fieldErrors: Record<string, string> = {};
  const cleaned: MediaLinkRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < (rows ?? []).length; index += 1) {
    const row = rows![index]!;
    if (isMediaLinkRowBlank(row)) continue;

    const platformRaw = String(row.platform ?? '').trim().toLowerCase();
    const url = normalizeSuggestLinkUrl(normalizeMediaLinkUrl(String(row.url ?? '')));
    const label = row.label?.trim() || null;

    if (!url && !platformRaw) continue;

    if (!isMediaPlatformLinkKey(platformRaw)) {
      fieldErrors[`links.${index}.platform`] = 'Choose a platform.';
      continue;
    }
    if (!url) {
      fieldErrors[`links.${index}.url`] = 'Enter a URL.';
      continue;
    }
    if (!/^https?:\/\//i.test(url)) {
      fieldErrors[`links.${index}.url`] = 'Enter a valid http(s) URL.';
      continue;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        fieldErrors[`links.${index}.url`] = 'Enter a valid http(s) URL.';
        continue;
      }
    } catch {
      fieldErrors[`links.${index}.url`] = 'Enter a valid http(s) URL.';
      continue;
    }

    const mismatch = getMediaPlatformUrlMismatchError(platformRaw, url);
    if (mismatch) {
      fieldErrors[`links.${index}.platform`] = mismatch;
      continue;
    }

    const key = mediaLinkUrlKey(url);
    if (seen.has(key)) {
      fieldErrors[`links.${index}.url`] = 'Duplicate URL.';
      fieldErrors.links = 'Each link URL must be unique.';
      continue;
    }
    seen.add(key);

    const coverage = mediaBrowseFilterToCoverage(getMediaLinkRowBrowseFilter(row));
    if (
      !coverage.isNational &&
      coverage.teamIds.length === 0 &&
      coverage.conferenceIds.length === 0
    ) {
      const message = `Select tags for Link ${index + 1}.`;
      fieldErrors[`links.${index}.coverage`] = message;
      if (!fieldErrors.links) fieldErrors.links = message;
      continue;
    }

    cleaned.push({
      id: row.id ?? null,
      platform: platformRaw,
      label,
      url,
      sortOrder: cleaned.length,
      isNational: coverage.isNational,
      teamIds: coverage.teamIds,
      conferenceIds: coverage.conferenceIds,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: fieldErrors.links || 'Fix the highlighted links.',
      fieldErrors,
    };
  }
  if (cleaned.length === 0) {
    return {
      ok: false,
      error: 'Add at least one link.',
      fieldErrors: { links: 'Add at least one link.' },
    };
  }
  return { ok: true, value: cleaned };
}

/** Collapse rows to legacy one-URL-per-platform map (first wins). */
export function mediaLinkRowsToPlatformLinks(rows: MediaLinkRow[]): MediaPlatformLinks {
  const out: MediaPlatformLinks = {};
  for (const row of rows) {
    if (!out[row.platform]) out[row.platform] = row.url;
  }
  return out;
}

/** Expand legacy map into rows (for migration / backward compat). */
export function platformLinksToMediaLinkRows(
  links: MediaPlatformLinks | Record<string, string> | null | undefined,
): MediaLinkRow[] {
  const rows: MediaLinkRow[] = [];
  for (const key of MEDIA_PLATFORM_LINK_KEYS) {
    const url = links?.[key]?.trim();
    if (!url) continue;
    rows.push({
      platform: key,
      label: null,
      url,
      sortOrder: rows.length,
      isNational: false,
      teamIds: [],
      conferenceIds: [],
    });
  }
  return rows;
}

export function formatMediaLinkActionLabel(row: Pick<MediaLinkRow, 'platform' | 'label'>): string {
  const platform = MEDIA_PLATFORM_LINK_LABELS[row.platform] ?? row.platform;
  const label = row.label?.trim();
  return label ? `${platform} · ${label}` : platform;
}

export function formatMediaLinkRowsForEmail(rows: MediaLinkRow[]): string {
  if (rows.length === 0) return 'None provided';
  const lines = rows.map((row) => {
    const heading = formatMediaLinkActionLabel(row);
    return `${heading}\n${row.url}`;
  });
  return ['Platform Links', ...lines].join('\n\n');
}

export function reorderMediaLinkRows(rows: MediaLinkRow[], fromIndex: number, toIndex: number): MediaLinkRow[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= rows.length ||
    toIndex >= rows.length ||
    fromIndex === toIndex
  ) {
    return rows.map((row, index) => ({ ...row, sortOrder: index }));
  }
  const next = [...rows];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next.map((row, index) => ({ ...row, sortOrder: index }));
}

export function mediaLinkRowsToRpcJson(rows: MediaLinkRow[]): Array<{
  platform: string;
  label: string | null;
  url: string;
  sort_order: number;
  is_national: boolean;
  team_ids: string[];
  conference_ids: string[];
}> {
  return rows.map((row, index) => ({
    platform: row.platform,
    label: row.label,
    url: row.url,
    sort_order: index,
    is_national: Boolean(row.isNational),
    team_ids: [...(row.teamIds ?? [])],
    conference_ids: [...(row.conferenceIds ?? [])],
  }));
}

/** Union coverage across validated links (compat top-level payload). */
export function unionMediaLinkRowCoverage(rows: MediaLinkRow[]): {
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
} {
  const teamIds: string[] = [];
  const conferenceIds: string[] = [];
  const seenTeams = new Set<string>();
  const seenConferences = new Set<string>();
  let isNational = false;
  for (const row of rows) {
    if (row.isNational) isNational = true;
    for (const teamId of row.teamIds ?? []) {
      const id = teamId.trim();
      if (!id || seenTeams.has(id)) continue;
      seenTeams.add(id);
      teamIds.push(id);
    }
    for (const conferenceId of row.conferenceIds ?? []) {
      const id = conferenceId.trim();
      if (!id || seenConferences.has(id)) continue;
      seenConferences.add(id);
      conferenceIds.push(id);
    }
  }
  return { isNational, teamIds, conferenceIds };
}

export function parseMediaLinkRowsFromApi(raw: unknown): MediaLinkRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: MediaLinkRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const platform = String(record.platform ?? '').trim().toLowerCase();
    const url = String(record.url ?? '').trim();
    if (!isMediaPlatformLinkKey(platform) || !url) continue;
    const teamIdsRaw = record.teamIds ?? record.team_ids;
    const conferenceIdsRaw = record.conferenceIds ?? record.conference_ids;
    const teamIds = Array.isArray(teamIdsRaw)
      ? teamIdsRaw.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const conferenceIds = Array.isArray(conferenceIdsRaw)
      ? conferenceIdsRaw.map((id) => String(id).trim()).filter(Boolean)
      : [];
    rows.push({
      id: typeof record.id === 'string' ? record.id : null,
      platform,
      label:
        typeof record.label === 'string' && record.label.trim()
          ? record.label.trim()
          : null,
      url,
      sortOrder:
        typeof record.sortOrder === 'number'
          ? record.sortOrder
          : typeof record.sort_order === 'number'
            ? record.sort_order
            : rows.length,
      isNational: Boolean(record.isNational ?? record.is_national),
      teamIds,
      conferenceIds,
    });
  }
  return rows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, index) => ({ ...row, sortOrder: index }));
}
