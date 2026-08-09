import {
  getMediaSourceConferenceIds,
  getMediaSourceTeamIds,
  sourceMatchesTeam,
} from '@/data/mediaDirectory/mediaCoverage';
import {
  cloneMediaBrowseFilter,
  coverageToMediaBrowseFilter,
  isMediaBrowseFilterActive,
} from '@/data/mediaDirectory/mediaBrowse';
import {
  mediaLinkRowHasCoverage,
  mediaLinkRowsToPlatformLinks,
  mediaLinkRowsToRpcJson,
  platformLinksToMediaLinkRows,
  unionMediaLinkRowCoverage,
  validateMediaLinkRows,
  type MediaLinkRow,
  type MediaLinkRowInput,
} from '@/data/mediaDirectory/mediaLinkRows';
import {
  MEDIA_PLATFORM_LINK_KEYS,
  countMediaPlatformLinks,
  normalizeMediaPlatformLinks,
  type MediaPlatformLinkKey,
  type MediaPlatformLinks,
} from '@/data/mediaDirectory/mediaPlatformLinks';
import {
  isValidSubmitterEmail,
  normalizeSubmitterEmail,
} from '@/data/mediaDirectory/mediaSuggestionNotifyEmail';
import {
  resolveConferenceBadgeLabel,
  resolveTeamBadgeLabel,
} from '@/data/mediaDirectory/mediaScopeBadge';
import {
  MEDIA_SUGGESTION_PROVIDERS,
  type MediaSource,
  type MediaSuggestionInput,
  type MediaSuggestionProvider,
} from '@/data/mediaDirectory/types';

function hasProviderUrl(url: string | null | undefined): boolean {
  return Boolean(url?.trim());
}

export type MediaSuggestionFieldErrors = Partial<
  Record<'name' | 'submitterEmail' | 'coverage' | 'links' | MediaPlatformLinkKey | string, string>
>;

export type MediaSuggestionValidationResult =
  | { ok: true; value: MediaSuggestionInput }
  | { ok: false; errors: string[]; fieldErrors: MediaSuggestionFieldErrors };

const PROVIDER_HOSTS: Record<MediaSuggestionProvider, string[]> = {
  spotify: ['open.spotify.com', 'spotify.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
};

export function isMediaSuggestionProvider(value: string): value is MediaSuggestionProvider {
  return (MEDIA_SUGGESTION_PROVIDERS as readonly string[]).includes(value);
}

/** Legacy single-provider copy from older client / edge function / RPC paths. */
export function isLegacyMediaSuggestionProviderError(message: string): boolean {
  return /Choose Spotify,\s*YouTube,\s*or X\.?/i.test(message.trim());
}

/** Exact named args for public.submit_media_suggestion (repeatable links). */
export type SubmitMediaSuggestionRpcPayload = {
  p_name: string;
  p_links: Array<{
    platform: string;
    label: string | null;
    url: string;
    sort_order: number;
    is_national: boolean;
    team_ids: string[];
    conference_ids: string[];
  }>;
  p_is_national: boolean;
  p_conference_ids: string[];
  p_team_ids: string[];
  p_notes: string | null;
  p_description: string | null;
  p_submitter_email: string;
  p_coverage_labels: {
    teams?: Record<string, string>;
    conferences?: Record<string, string>;
  };
  /** Compat dual-write for legacy column sync inside RPC. */
  p_platform_links: MediaPlatformLinks;
};

export function buildSubmitMediaSuggestionRpcPayload(
  value: MediaSuggestionInput,
): SubmitMediaSuggestionRpcPayload {
  return {
    p_name: value.name,
    p_links: mediaLinkRowsToRpcJson(value.links),
    p_is_national: value.isNational,
    p_conference_ids: value.conferenceIds,
    p_team_ids: value.teamIds,
    p_coverage_labels: value.coverageLabels ?? { teams: {}, conferences: {} },
    p_submitter_email: value.submitterEmail,
    p_notes: value.notes ?? null,
    p_description: value.description ?? null,
    p_platform_links: value.platformLinks,
  };
}

export function isValidHttpUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidProviderUrl(
  provider: MediaSuggestionProvider,
  rawUrl: string,
): boolean {
  if (!isValidHttpUrl(rawUrl)) return false;
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    return PROVIDER_HOSTS[provider].includes(host);
  } catch {
    return false;
  }
}

function uniqueTrimmed(ids: Array<string | null | undefined> | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids ?? []) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function validateMediaSuggestionInput(
  input: Partial<MediaSuggestionInput> & {
    /** @deprecated legacy single-select */
    scope?: string;
    conferenceId?: string | null;
    teamId?: string | null;
    /** @deprecated legacy single provider + url */
    provider?: string;
    submittedUrl?: string | null;
    /** Draft rows from the repeatable editor (may include blanks). */
    linkRows?: MediaLinkRowInput[];
  },
): MediaSuggestionValidationResult {
  const errors: string[] = [];
  const fieldErrors: MediaSuggestionFieldErrors = {};
  const name = input.name?.trim() ?? '';
  const description = input.description?.trim() || null;
  const notes = input.notes?.trim() || null;
  const submitterEmailRaw = input.submitterEmail ?? '';
  const submitterEmail = normalizeSubmitterEmail(submitterEmailRaw);

  let isNational = Boolean(input.isNational);
  let conferenceIds = uniqueTrimmed(input.conferenceIds);
  let teamIds = uniqueTrimmed(input.teamIds);

  if (
    !isNational &&
    conferenceIds.length === 0 &&
    teamIds.length === 0 &&
    input.scope
  ) {
    if (input.scope === 'national') isNational = true;
    if (input.scope === 'conference' && input.conferenceId?.trim()) {
      conferenceIds = [input.conferenceId.trim()];
    }
    if (input.scope === 'team' && input.teamId?.trim()) {
      teamIds = [input.teamId.trim()];
    }
  }

  let linkRowsInput: MediaLinkRowInput[] = [
    ...(input.linkRows ?? input.links ?? []),
  ];

  if (linkRowsInput.length === 0 && input.platformLinks) {
    linkRowsInput = platformLinksToMediaLinkRows(input.platformLinks);
  }

  if (
    linkRowsInput.length === 0 &&
    input.provider &&
    input.submittedUrl?.trim()
  ) {
    const legacyKey = input.provider.trim().toLowerCase();
    if ((MEDIA_PLATFORM_LINK_KEYS as readonly string[]).includes(legacyKey)) {
      linkRowsInput = [
        {
          platform: legacyKey,
          label: null,
          url: input.submittedUrl.trim(),
          sortOrder: 0,
        },
      ];
    }
  }

  // Compat: older callers that only send top-level coverage fan it onto every link.
  const topLevelCoverageFilter = coverageToMediaBrowseFilter({
    isNational,
    teamIds,
    conferenceIds,
    teamLabels: input.coverageLabels?.teams,
    conferenceLabels: input.coverageLabels?.conferences,
  });
  const anyLinkHasCoverage = linkRowsInput.some((row) => mediaLinkRowHasCoverage(row));
  if (!anyLinkHasCoverage && isMediaBrowseFilterActive(topLevelCoverageFilter)) {
    linkRowsInput = linkRowsInput.map((row) => ({
      ...row,
      coverage: cloneMediaBrowseFilter(topLevelCoverageFilter),
    }));
  }

  const linksResult = validateMediaLinkRows(linkRowsInput);
  let links: MediaLinkRow[] = [];
  let platformLinks: MediaPlatformLinks = {};

  if (!linksResult.ok) {
    Object.assign(fieldErrors, linksResult.fieldErrors);
    errors.push(linksResult.error);
  } else {
    links = linksResult.value;
    platformLinks = mediaLinkRowsToPlatformLinks(links);
    // Authoritative suggestion-level coverage = union of link coverage.
    const union = unionMediaLinkRowCoverage(links);
    isNational = union.isNational;
    teamIds = union.teamIds;
    conferenceIds = union.conferenceIds;
  }

  if (!name) {
    const message = 'Creator or podcast name is required.';
    fieldErrors.name = message;
    errors.push(message);
  }

  // Email is optional; when provided it must be a valid address.
  if (submitterEmail && !isValidSubmitterEmail(submitterEmail)) {
    const message = 'Enter a valid email address.';
    fieldErrors.submitterEmail = message;
    errors.push(message);
  }

  if (
    linksResult.ok &&
    !isNational &&
    conferenceIds.length === 0 &&
    teamIds.length === 0
  ) {
    const message = 'Choose at least one tag.';
    fieldErrors.coverage = message;
    errors.push(message);
  }

  if (errors.length > 0) {
    return { ok: false, errors, fieldErrors };
  }

  return {
    ok: true,
    value: {
      name,
      links,
      platformLinks: normalizeMediaPlatformLinks(platformLinks),
      isNational,
      conferenceIds,
      teamIds,
      submitterEmail,
      description,
      notes,
      coverageLabel: input.coverageLabel?.trim() || null,
      coverageLabels: input.coverageLabels ?? { teams: {}, conferences: {} },
    },
  };
}

/** Case-insensitive alphabetical by name; stable by id when names match. */
export function compareMediaSourcesByName(a: MediaSource, b: MediaSource): number {
  const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
}

function buildMediaSearchHaystack(source: MediaSource): string {
  const teamLabels = getMediaSourceTeamIds(source).map(
    (id) => resolveTeamBadgeLabel(id) ?? id,
  );
  const conferenceLabels = getMediaSourceConferenceIds(source).map(
    (id) => resolveConferenceBadgeLabel(id) ?? id,
  );
  return [
    source.name,
    source.subtitle ?? '',
    source.description ?? '',
    ...teamLabels,
    ...conferenceLabels,
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Full approved media directory: optional team association + search.
 * Default order is alphabetical by source name.
 */
export function filterMediaSources(
  sources: MediaSource[],
  options: {
    search?: string;
    /** When set, only sources explicitly associated with this team id. */
    teamId?: string | null;
  } = {},
): MediaSource[] {
  const query = options.search?.trim().toLowerCase() ?? '';
  const teamId = options.teamId?.trim() || null;

  return sources
    .filter((source) => {
      if (!source.is_approved) return false;
      if (teamId && !sourceMatchesTeam(source, teamId)) return false;
      if (!query) return true;
      return buildMediaSearchHaystack(source).includes(query);
    })
    .slice()
    .sort(compareMediaSourcesByName);
}

/** Conference association helper (explicit conferenceIds / legacy conference_id). */
export function filterMediaSourcesByConference(
  sources: MediaSource[],
  conferenceId: string,
): MediaSource[] {
  const needle = conferenceId.trim();
  if (!needle) return [];
  return sources
    .filter((source) => source.is_approved)
    .filter(
      (source) =>
        source.conferenceIds?.includes(needle) || source.conference_id === needle,
    )
    .slice()
    .sort(compareMediaSourcesByName);
}

/** Explicit team association only — not national-only or conference-only. */
export function filterMediaSourcesByTeam(
  sources: MediaSource[],
  teamId: string,
  options?: { requireProviderUrl?: boolean; limit?: number },
): MediaSource[] {
  const needle = teamId.trim();
  if (!needle) return [];

  const filtered = sources
    .filter((source) => source.is_approved && sourceMatchesTeam(source, needle))
    .filter((source) =>
      options?.requireProviderUrl ? mediaSourceHasProviderUrl(source) : true,
    )
    .slice()
    .sort(compareMediaSourcesByName);

  if (typeof options?.limit === 'number' && options.limit >= 0) {
    return filtered.slice(0, options.limit);
  }
  return filtered;
}

export function mediaSourceHasProviderUrl(source: MediaSource): boolean {
  if (source.links?.length) return source.links.some((link) => hasProviderUrl(link.url));
  return (
    hasProviderUrl(source.spotify_url) ||
    hasProviderUrl(source.youtube_url) ||
    hasProviderUrl(source.x_url) ||
    hasProviderUrl(source.apple_podcast_url)
  );
}

// Re-export for tests that still check count helpers.
export { countMediaPlatformLinks };
