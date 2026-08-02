import type { Href } from 'expo-router';

import { isKnownMediaConferenceId, isKnownMediaTeamId } from '@/data/mediaDirectory/contextualMedia';
import { queueDiscoverMediaHandoff } from '@/data/mediaDirectory/discoverMediaHandoff';

/** Open Discover → Media filtered to an explicit team association. */
export function buildDiscoverTeamMediaHref(teamId: string, teamName?: string): Href {
  const id = teamId.trim();
  const params: Record<string, string> = {
    section: 'media',
  };
  if (isKnownMediaTeamId(id)) {
    params.teamId = id;
    const name = teamName?.trim();
    if (name) params.teamName = name;
  }

  return {
    pathname: '/(tabs)/news',
    params,
  };
}

/** Open Discover → Media with a conference browse filter chip applied. */
export function buildDiscoverConferenceMediaHref(
  conferenceId: string,
  conferenceName?: string,
): Href {
  const id = conferenceId.trim();
  const params: Record<string, string> = {
    section: 'media',
  };
  if (isKnownMediaConferenceId(id)) {
    params.conferenceId = id;
    const name = conferenceName?.trim();
    if (name) params.conferenceName = name;
  }

  return {
    pathname: '/(tabs)/news',
    params,
  };
}

/**
 * Queue a consume-once handoff, then return the Discover href.
 * Prefer this from View All so tab navigators still receive the filter.
 */
export function prepareDiscoverTeamMediaNavigation(
  teamId: string,
  teamName?: string,
): Href {
  const id = teamId.trim();
  if (isKnownMediaTeamId(id)) {
    queueDiscoverMediaHandoff({
      teamId: id,
      teamName: teamName?.trim() || null,
      conferenceId: null,
      conferenceName: null,
    });
  }
  return buildDiscoverTeamMediaHref(id, teamName);
}

export function prepareDiscoverConferenceMediaNavigation(
  conferenceId: string,
  conferenceName?: string,
): Href {
  const id = conferenceId.trim();
  if (isKnownMediaConferenceId(id)) {
    queueDiscoverMediaHandoff({
      teamId: null,
      teamName: null,
      conferenceId: id,
      conferenceName: conferenceName?.trim() || null,
    });
  }
  return buildDiscoverConferenceMediaHref(id, conferenceName);
}
