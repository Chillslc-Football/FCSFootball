/**
 * Contextual Team / Conference media helpers: ordering, dedupe, and safe route defaults.
 */
import type { Href } from 'expo-router';

import {
  createEmptyMediaBrowseFilter,
  isMediaBrowseConferenceId,
  type MediaBrowseFilter,
} from '@/data/mediaDirectory/mediaBrowse';
import {
  isMediaSourceNational,
  sourceMatchesConference,
  sourceMatchesTeam,
} from '@/data/mediaDirectory/mediaCoverage';
import {
  resolveConferenceBadgeLabel,
  resolveTeamBadgeLabel,
} from '@/data/mediaDirectory/mediaScopeBadge';
import { compareMediaSourcesByName } from '@/data/mediaDirectory/mediaSourceValidation';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { isEspnTeamId } from '@/utils/teamId';

export const CONTEXTUAL_MEDIA_INLINE_LIMIT = 4;

export function isKnownMediaConferenceId(conferenceId: string | null | undefined): boolean {
  return isMediaBrowseConferenceId(conferenceId);
}

export function isKnownMediaTeamId(teamId: string | null | undefined): boolean {
  const id = teamId?.trim();
  if (!id) return false;
  return isEspnTeamId(id);
}

function approvedOnly(sources: MediaSource[]): MediaSource[] {
  return sources.filter((source) => source.is_approved);
}

/**
 * Team page media: exact team → conference-tagged (not already listed) → national.
 * Dedupes by source id. Alphabetical within each tier.
 */
export function selectTeamContextualMedia(
  sources: MediaSource[],
  input: {
    teamId: string;
    conferenceId?: string | null;
    limit?: number;
  },
): MediaSource[] {
  const teamId = input.teamId.trim();
  if (!teamId) return [];

  const conferenceId = input.conferenceId?.trim() || null;
  const approved = approvedOnly(sources);
  const seen = new Set<string>();
  const ordered: MediaSource[] = [];

  function pushTier(tier: MediaSource[]) {
    for (const source of tier.slice().sort(compareMediaSourcesByName)) {
      if (seen.has(source.id)) continue;
      seen.add(source.id);
      ordered.push(source);
    }
  }

  pushTier(approved.filter((source) => sourceMatchesTeam(source, teamId)));

  if (conferenceId && isKnownMediaConferenceId(conferenceId)) {
    pushTier(
      approved.filter(
        (source) =>
          sourceMatchesConference(source, conferenceId) && !sourceMatchesTeam(source, teamId),
      ),
    );
  }

  pushTier(
    approved.filter(
      (source) =>
        isMediaSourceNational(source) &&
        !sourceMatchesTeam(source, teamId) &&
        !(conferenceId && sourceMatchesConference(source, conferenceId)),
    ),
  );

  const limit = input.limit;
  if (typeof limit === 'number' && limit >= 0) return ordered.slice(0, limit);
  return ordered;
}

/**
 * Conference page media: conference-tagged → national.
 * Excludes team-only creators that are not conference-tagged.
 */
export function selectConferenceContextualMedia(
  sources: MediaSource[],
  input: {
    conferenceId: string;
    limit?: number;
  },
): MediaSource[] {
  const conferenceId = input.conferenceId.trim();
  if (!conferenceId || !isKnownMediaConferenceId(conferenceId)) return [];

  const approved = approvedOnly(sources);
  const seen = new Set<string>();
  const ordered: MediaSource[] = [];

  function pushTier(tier: MediaSource[]) {
    for (const source of tier.slice().sort(compareMediaSourcesByName)) {
      if (seen.has(source.id)) continue;
      seen.add(source.id);
      ordered.push(source);
    }
  }

  pushTier(approved.filter((source) => sourceMatchesConference(source, conferenceId)));

  pushTier(
    approved.filter(
      (source) =>
        isMediaSourceNational(source) && !sourceMatchesConference(source, conferenceId),
    ),
  );

  const limit = input.limit;
  if (typeof limit === 'number' && limit >= 0) return ordered.slice(0, limit);
  return ordered;
}

export type SuggestMediaRouteParams = {
  teamId?: string | null;
  teamName?: string | null;
  conferenceId?: string | null;
  conferenceName?: string | null;
};

/** Build typed href for Suggest FCS Media with optional coverage defaults. */
export function buildSuggestMediaHref(params: SuggestMediaRouteParams = {}): Href {
  const query: Record<string, string> = {};
  const teamId = params.teamId?.trim();
  const conferenceId = params.conferenceId?.trim();
  const teamName = params.teamName?.trim();
  const conferenceName = params.conferenceName?.trim();

  if (teamId && isKnownMediaTeamId(teamId)) {
    query.teamId = teamId;
    if (teamName) query.teamName = teamName;
  }
  if (conferenceId && isKnownMediaConferenceId(conferenceId)) {
    query.conferenceId = conferenceId;
    if (conferenceName) query.conferenceName = conferenceName;
  }

  if (Object.keys(query).length === 0) {
    return '/suggest-fcs-media';
  }

  return {
    pathname: '/suggest-fcs-media',
    params: query,
  };
}

/**
 * Validate route params and build an initial coverage filter.
 * Invalid IDs are ignored. National is never auto-selected.
 */
export function resolveSuggestCoverageFromParams(
  params: SuggestMediaRouteParams,
): MediaBrowseFilter {
  const filter = createEmptyMediaBrowseFilter();
  const teamId = params.teamId?.trim();
  const conferenceId = params.conferenceId?.trim();

  if (teamId && isKnownMediaTeamId(teamId)) {
    const label =
      params.teamName?.trim() ||
      resolveTeamBadgeLabel(teamId) ||
      `Team ${teamId}`;
    filter.teams = [{ id: teamId, label }];
  }

  if (conferenceId && isKnownMediaConferenceId(conferenceId)) {
    const label =
      params.conferenceName?.trim() ||
      resolveConferenceBadgeLabel(conferenceId) ||
      conferenceId;
    filter.conferences = [{ id: conferenceId, label }];
  }

  filter.national = false;
  return filter;
}

/** Build a browse filter for Discovery View All (team chip only — not National). */
export function buildTeamBrowseFilter(
  teamId: string,
  teamName?: string | null,
): MediaBrowseFilter {
  const filter = createEmptyMediaBrowseFilter();
  const id = teamId.trim();
  if (!isKnownMediaTeamId(id)) return filter;
  filter.teams = [
    {
      id,
      label: teamName?.trim() || resolveTeamBadgeLabel(id) || `Team ${id}`,
    },
  ];
  filter.national = false;
  return filter;
}

/** Build a browse filter for Discovery View All (conference chip only — not National). */
export function buildConferenceBrowseFilter(
  conferenceId: string,
  conferenceName?: string | null,
): MediaBrowseFilter {
  const filter = createEmptyMediaBrowseFilter();
  const id = conferenceId.trim();
  if (!isKnownMediaConferenceId(id)) return filter;
  filter.conferences = [
    {
      id,
      label: conferenceName?.trim() || resolveConferenceBadgeLabel(id) || id,
    },
  ];
  filter.national = false;
  return filter;
}

/** Initials fallback for compact media artwork. */
export function getMediaCreatorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export const SUGGEST_MEDIA_A11Y_LABEL = 'Suggest media';
