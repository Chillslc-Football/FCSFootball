import {
  getMediaSourceConferenceIds,
  getMediaSourceTeamIds,
  sourceMatchesTeam,
} from '@/data/mediaDirectory/mediaCoverage';
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

export type MediaSuggestionValidationResult =
  | { ok: true; value: MediaSuggestionInput }
  | { ok: false; errors: string[] };

const PROVIDER_HOSTS: Record<MediaSuggestionProvider, string[]> = {
  spotify: ['open.spotify.com', 'spotify.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
};

export function isMediaSuggestionProvider(value: string): value is MediaSuggestionProvider {
  return (MEDIA_SUGGESTION_PROVIDERS as readonly string[]).includes(value);
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
  },
): MediaSuggestionValidationResult {
  const errors: string[] = [];
  const provider = input.provider;
  const submittedUrl = input.submittedUrl?.trim() ?? '';
  const notes = input.notes?.trim() || null;

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

  if (!provider || !isMediaSuggestionProvider(provider)) {
    errors.push('Choose Spotify, YouTube, or X.');
  }
  if (!submittedUrl) {
    errors.push('Link is required.');
  } else if (provider && isMediaSuggestionProvider(provider) && !isValidProviderUrl(provider, submittedUrl)) {
    errors.push(`Enter a valid ${provider === 'x' ? 'X' : provider} link.`);
  }
  if (!isNational && conferenceIds.length === 0 && teamIds.length === 0) {
    errors.push('Select National FCS, at least one conference, or at least one team.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      provider: provider as MediaSuggestionProvider,
      submittedUrl,
      isNational,
      conferenceIds,
      teamIds,
      notes,
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
  return (
    hasProviderUrl(source.spotify_url) ||
    hasProviderUrl(source.youtube_url) ||
    hasProviderUrl(source.x_url) ||
    hasProviderUrl(source.apple_podcast_url)
  );
}
