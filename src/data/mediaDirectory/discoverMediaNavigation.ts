import type { Href } from 'expo-router';

/** Open Discover → Media filtered to an explicit team association. */
export function buildDiscoverTeamMediaHref(teamId: string, teamName?: string): Href {
  const params: Record<string, string> = {
    section: 'media',
    teamId: teamId.trim(),
  };
  const name = teamName?.trim();
  if (name) params.teamName = name;

  return {
    pathname: '/(tabs)/news',
    params,
  };
}
