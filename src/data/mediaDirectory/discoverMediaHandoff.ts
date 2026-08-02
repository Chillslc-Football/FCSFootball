/**
 * Reliable Discover → Media filter handoff for tab navigators.
 * View All queues a payload; Discover consumes it once on focus/mount.
 */
import {
  buildConferenceBrowseFilter,
  buildTeamBrowseFilter,
  isKnownMediaConferenceId,
  isKnownMediaTeamId,
} from '@/data/mediaDirectory/contextualMedia';
import {
  createEmptyMediaBrowseFilter,
  type MediaBrowseFilter,
} from '@/data/mediaDirectory/mediaBrowse';

export type DiscoverMediaHandoffPayload = {
  teamId?: string | null;
  teamName?: string | null;
  conferenceId?: string | null;
  conferenceName?: string | null;
};

export type DiscoverMediaHandoff = {
  /** Monotonic id so the same team/conference can be re-applied on a later View All. */
  id: number;
  payload: DiscoverMediaHandoffPayload;
};

export type DiscoverMediaBrowseSeed = {
  id: number;
  filter: MediaBrowseFilter;
};

let nextHandoffId = 1;
let queued: DiscoverMediaHandoff | null = null;
let lastConsumedId = 0;

function firstParam(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/** Queue a View All / deep-link filter before navigating to Discover. */
export function queueDiscoverMediaHandoff(
  payload: DiscoverMediaHandoffPayload,
): DiscoverMediaHandoff {
  const handoff: DiscoverMediaHandoff = {
    id: nextHandoffId++,
    payload: {
      teamId: payload.teamId?.trim() || null,
      teamName: payload.teamName?.trim() || null,
      conferenceId: payload.conferenceId?.trim() || null,
      conferenceName: payload.conferenceName?.trim() || null,
    },
  };
  queued = handoff;
  return handoff;
}

/** Consume the queued handoff exactly once. */
export function takeDiscoverMediaHandoff(): DiscoverMediaHandoff | null {
  if (!queued || queued.id === lastConsumedId) return null;
  lastConsumedId = queued.id;
  const value = queued;
  queued = null;
  return value;
}

/** Test helper — reset module state between cases. */
export function resetDiscoverMediaHandoffForTests(): void {
  queued = null;
  lastConsumedId = 0;
  nextHandoffId = 1;
}

export function resolveDiscoverMediaHandoffFromParams(params: {
  teamId?: string | string[] | null;
  teamName?: string | string[] | null;
  conferenceId?: string | string[] | null;
  conferenceName?: string | string[] | null;
}): DiscoverMediaHandoffPayload | null {
  const teamIdRaw = firstParam(params.teamId)?.trim();
  const conferenceIdRaw = firstParam(params.conferenceId)?.trim();
  const teamName = firstParam(params.teamName)?.trim() || null;
  const conferenceName = firstParam(params.conferenceName)?.trim() || null;

  const teamId = teamIdRaw && isKnownMediaTeamId(teamIdRaw) ? teamIdRaw : null;
  const conferenceId =
    conferenceIdRaw && isKnownMediaConferenceId(conferenceIdRaw) ? conferenceIdRaw : null;

  if (!teamId && !conferenceId) return null;

  return {
    teamId,
    teamName: teamId ? teamName : null,
    conferenceId,
    conferenceName: conferenceId ? conferenceName : null,
  };
}

/**
 * Build a Discovery browse filter from a validated handoff.
 * Team and conference are mutually exclusive unless both are explicitly present.
 * National is never auto-selected.
 */
export function buildDiscoverBrowseFilterFromHandoff(
  payload: DiscoverMediaHandoffPayload,
): MediaBrowseFilter {
  const teamId = payload.teamId?.trim();
  const conferenceId = payload.conferenceId?.trim();

  const validTeam = teamId && isKnownMediaTeamId(teamId) ? teamId : null;
  const validConference =
    conferenceId && isKnownMediaConferenceId(conferenceId) ? conferenceId : null;

  if (validTeam && !validConference) {
    return buildTeamBrowseFilter(validTeam, payload.teamName);
  }
  if (validConference && !validTeam) {
    return buildConferenceBrowseFilter(validConference, payload.conferenceName);
  }
  if (validTeam && validConference) {
    const filter = createEmptyMediaBrowseFilter();
    const teamFilter = buildTeamBrowseFilter(validTeam, payload.teamName);
    const conferenceFilter = buildConferenceBrowseFilter(validConference, payload.conferenceName);
    filter.teams = teamFilter.teams;
    filter.conferences = conferenceFilter.conferences;
    filter.national = false;
    return filter;
  }
  return createEmptyMediaBrowseFilter();
}

export function buildDiscoverMediaBrowseSeed(
  handoff: DiscoverMediaHandoff,
): DiscoverMediaBrowseSeed {
  return {
    id: handoff.id,
    filter: buildDiscoverBrowseFilterFromHandoff(handoff.payload),
  };
}

/** Stable key for route-param fallback consumption (when no queue entry exists). */
export function discoverMediaParamConsumptionKey(
  payload: DiscoverMediaHandoffPayload,
): string {
  const teamId = payload.teamId?.trim() || '';
  const conferenceId = payload.conferenceId?.trim() || '';
  return `team:${teamId}|conference:${conferenceId}`;
}
