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

/** Primary empty copy for Team page contextual media. */
export const TEAM_CONTEXTUAL_MEDIA_EMPTY_MESSAGE = 'No team media found.';

/** Optional supporting line under the Team media empty state. */
export const TEAM_CONTEXTUAL_MEDIA_EMPTY_SUPPORTING =
  'Know a creator who covers this team?';

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
 * Team page media: approved creators explicitly tagged to this team only.
 * No conference-only or national-only fallback.
 * National creators still appear when they are also tagged to this team.
 *
 * `conferenceId` is accepted for call-site compatibility but is not used for selection.
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

  const matching = approvedOnly(sources)
    .filter((source) => sourceMatchesTeam(source, teamId))
    .slice()
    .sort(compareMediaSourcesByName);

  const limit = input.limit;
  if (typeof limit === 'number' && limit >= 0) return matching.slice(0, limit);
  return matching;
}

/**
 * Conference page media: creators whose derived coverage includes this conference.
 * Does not include national-only or team-only creators unless they also list the conference.
 * No team→conference inference.
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

  const matching = approvedOnly(sources)
    .filter((source) => sourceMatchesConference(source, conferenceId))
    .slice()
    .sort(compareMediaSourcesByName);

  const limit = input.limit;
  if (typeof limit === 'number' && limit >= 0) return matching.slice(0, limit);
  return matching;
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
