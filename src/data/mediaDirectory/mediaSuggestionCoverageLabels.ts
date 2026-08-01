import {
  resolveConferenceBadgeLabel,
  resolveTeamBadgeLabel,
} from '@/data/mediaDirectory/mediaScopeBadge';

export type MediaSuggestionCoverageLabels = {
  teams?: Record<string, string>;
  conferences?: Record<string, string>;
};

/** Build stored coverage label maps from browse selections. */
export function buildMediaSuggestionCoverageLabels(input: {
  teams?: Array<{ id: string; label: string }>;
  conferences?: Array<{ id: string; label: string }>;
}): MediaSuggestionCoverageLabels {
  const teams: Record<string, string> = {};
  for (const team of input.teams ?? []) {
    const id = team.id?.trim();
    const label = team.label?.trim();
    if (id && label) teams[id] = label;
  }
  const conferences: Record<string, string> = {};
  for (const conference of input.conferences ?? []) {
    const id = conference.id?.trim();
    const label = conference.label?.trim();
    if (id && label) conferences[id] = label;
  }
  return { teams, conferences };
}

export function resolveMediaSuggestionTeamNames(
  teamIds: string[],
  labels?: MediaSuggestionCoverageLabels | null,
): string[] {
  return teamIds.map((id) => {
    const trimmed = id.trim();
    const fromStore = labels?.teams?.[trimmed]?.trim();
    if (fromStore) return fromStore;
    return resolveTeamBadgeLabel(trimmed) ?? trimmed;
  });
}

export function resolveMediaSuggestionConferenceNames(
  conferenceIds: string[],
  labels?: MediaSuggestionCoverageLabels | null,
): string[] {
  return conferenceIds.map((id) => {
    const trimmed = id.trim();
    const fromStore = labels?.conferences?.[trimmed]?.trim();
    if (fromStore) return fromStore;
    return resolveConferenceBadgeLabel(trimmed) ?? trimmed;
  });
}
