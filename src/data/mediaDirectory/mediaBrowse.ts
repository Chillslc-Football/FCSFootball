import {
  getMediaSourceConferenceIds,
  getMediaSourceTeamIds,
  isMediaSourceNational,
  sourceMatchesConference,
  sourceMatchesTeam,
} from '@/data/mediaDirectory/mediaCoverage';
import {
  resolveConferenceBadgeLabel,
  resolveTeamBadgeLabel,
} from '@/data/mediaDirectory/mediaScopeBadge';
import { normalizeTeamName } from '@/data/providers/teamNameMatch';
import type { MediaSource } from '@/data/mediaDirectory/types';
import type { EspnNormalizedGame } from '@/types';
import { isEspnTeamId } from '@/utils/teamId';

export type MediaBrowseTeamSelection = {
  id: string;
  label: string;
};

export type MediaBrowseConferenceSelection = {
  id: string;
  label: string;
};

/** Multi-select browse state: National + any teams + any conferences (OR-matched). */
export type MediaBrowseFilter = {
  national: boolean;
  teams: MediaBrowseTeamSelection[];
  conferences: MediaBrowseConferenceSelection[];
};

export type MediaBrowseChip = {
  key: string;
  kind: 'national' | 'team' | 'conference';
  label: string;
  teamId?: string;
  conferenceId?: string;
};

export type MediaBrowseTeamOption = {
  id: string;
  name: string;
};

export type MediaBrowseConferenceOption = {
  id: string;
  name: string;
};

export const EMPTY_MEDIA_BROWSE_FILTER: MediaBrowseFilter = {
  national: false,
  teams: [],
  conferences: [],
};

/** FCS conference ids for browse (kept here to avoid RN-coupled conferenceList imports in tests). */
const FCS_CONFERENCE_IDS = [
  'big-sky',
  'big-south-ovc',
  'caa',
  'fcs-independents',
  'ivy-league',
  'meac',
  'mvfc',
  'nec',
  'patriot',
  'pioneer',
  'southern',
  'southland',
  'swac',
  'united-athletic',
] as const;

export function createEmptyMediaBrowseFilter(): MediaBrowseFilter {
  return { national: false, teams: [], conferences: [] };
}

/** Deep-enough clone so link coverage state stays independent. */
export function cloneMediaBrowseFilter(filter: MediaBrowseFilter): MediaBrowseFilter {
  return {
    national: filter.national,
    teams: filter.teams.map((team) => ({ id: team.id, label: team.label })),
    conferences: filter.conferences.map((conference) => ({
      id: conference.id,
      label: conference.label,
    })),
  };
}

export function isMediaBrowseFilterActive(filter: MediaBrowseFilter): boolean {
  return filter.national || filter.teams.length > 0 || filter.conferences.length > 0;
}

/** Human-readable coverage list for emails / summaries. */
export function formatMediaBrowseCoverageLabel(filter: MediaBrowseFilter): string {
  return getMediaBrowseChips(filter)
    .map((chip) => chip.label)
    .join(', ');
}

/**
 * Compact one-line coverage for Suggest link cards.
 * Examples: "National", "Montana State, Big Sky", "Montana State, Big Sky +2"
 */
export function formatCompactMediaBrowseCoverageSummary(
  filter: MediaBrowseFilter,
  maxVisible = 2,
): string {
  const chips = getMediaBrowseChips(filter);
  if (chips.length === 0) return '';
  if (chips.length <= maxVisible) {
    return chips.map((chip) => chip.label).join(', ');
  }
  const visible = chips
    .slice(0, maxVisible)
    .map((chip) => chip.label)
    .join(', ');
  return `${visible} +${chips.length - maxVisible}`;
}

/** Map browse selection into suggestion / API coverage fields. */
export function mediaBrowseFilterToCoverage(filter: MediaBrowseFilter): {
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
} {
  return {
    isNational: filter.national,
    teamIds: filter.teams.map((team) => team.id),
    conferenceIds: filter.conferences.map((conference) => conference.id),
  };
}

/** Rebuild a browse filter from ids + optional label maps (picker display). */
export function coverageToMediaBrowseFilter(input: {
  isNational?: boolean;
  teamIds?: string[];
  conferenceIds?: string[];
  teamLabels?: Record<string, string> | null;
  conferenceLabels?: Record<string, string> | null;
}): MediaBrowseFilter {
  const teams = (input.teamIds ?? []).map((id) => {
    const trimmed = id.trim();
    return {
      id: trimmed,
      label:
        input.teamLabels?.[trimmed]?.trim() ||
        resolveTeamBadgeLabel(trimmed) ||
        trimmed,
    };
  });
  const conferences = (input.conferenceIds ?? []).map((id) => {
    const trimmed = id.trim();
    return {
      id: trimmed,
      label:
        input.conferenceLabels?.[trimmed]?.trim() ||
        resolveConferenceBadgeLabel(trimmed) ||
        trimmed,
    };
  });
  return {
    national: Boolean(input.isNational),
    teams,
    conferences,
  };
}

/** Union of browse filters (OR of national; distinct teams/conferences). */
export function unionMediaBrowseFilters(filters: MediaBrowseFilter[]): MediaBrowseFilter {
  const out = createEmptyMediaBrowseFilter();
  const teamById = new Map<string, string>();
  const conferenceById = new Map<string, string>();
  for (const filter of filters) {
    if (filter.national) out.national = true;
    for (const team of filter.teams) {
      if (!teamById.has(team.id)) teamById.set(team.id, team.label);
    }
    for (const conference of filter.conferences) {
      if (!conferenceById.has(conference.id)) {
        conferenceById.set(conference.id, conference.label);
      }
    }
  }
  out.teams = [...teamById.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  out.conferences = [...conferenceById.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return out;
}

/** Removable chip list for sheet + search-row display. */
export function getMediaBrowseChips(filter: MediaBrowseFilter): MediaBrowseChip[] {
  const chips: MediaBrowseChip[] = [];
  if (filter.national) {
    chips.push({ key: 'national', kind: 'national', label: 'National' });
  }
  for (const team of filter.teams) {
    chips.push({
      key: `team:${team.id}`,
      kind: 'team',
      label: team.label,
      teamId: team.id,
    });
  }
  for (const conference of filter.conferences) {
    chips.push({
      key: `conference:${conference.id}`,
      kind: 'conference',
      label: conference.label,
      conferenceId: conference.id,
    });
  }
  return chips;
}

export function removeMediaBrowseChip(
  filter: MediaBrowseFilter,
  chip: MediaBrowseChip,
): MediaBrowseFilter {
  switch (chip.kind) {
    case 'national':
      return { ...filter, national: false };
    case 'team':
      return {
        ...filter,
        teams: filter.teams.filter((team) => team.id !== chip.teamId),
      };
    case 'conference':
      return {
        ...filter,
        conferences: filter.conferences.filter(
          (conference) => conference.id !== chip.conferenceId,
        ),
      };
    default:
      return filter;
  }
}

export function toggleMediaBrowseNational(filter: MediaBrowseFilter): MediaBrowseFilter {
  return { ...filter, national: !filter.national };
}

export function toggleMediaBrowseTeam(
  filter: MediaBrowseFilter,
  team: MediaBrowseTeamSelection,
): MediaBrowseFilter {
  const exists = filter.teams.some((entry) => entry.id === team.id);
  return {
    ...filter,
    teams: exists
      ? filter.teams.filter((entry) => entry.id !== team.id)
      : [...filter.teams, team].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
        ),
  };
}

export function toggleMediaBrowseConference(
  filter: MediaBrowseFilter,
  conference: MediaBrowseConferenceSelection,
): MediaBrowseFilter {
  const exists = filter.conferences.some((entry) => entry.id === conference.id);
  return {
    ...filter,
    conferences: exists
      ? filter.conferences.filter((entry) => entry.id !== conference.id)
      : [...filter.conferences, conference].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
        ),
  };
}

/** Active indicator for the filter icon (chip count). */
export function getMediaBrowseBadgeLetter(filter: MediaBrowseFilter): string | null {
  const count = getMediaBrowseChips(filter).length;
  return count > 0 ? String(count) : null;
}

/**
 * Apply browse selections with OR semantics:
 * National OR any selected team OR any selected conference.
 */
export function filterMediaSourcesByBrowse(
  sources: MediaSource[],
  filter: MediaBrowseFilter,
): MediaSource[] {
  if (!isMediaBrowseFilterActive(filter)) return sources;

  return sources.filter((source) => {
    if (filter.national && isMediaSourceNational(source)) return true;
    if (filter.teams.some((team) => sourceMatchesTeam(source, team.id))) return true;
    if (filter.conferences.some((conference) => sourceMatchesConference(source, conference.id))) {
      return true;
    }
    return false;
  });
}

/** FCS conferences for the browse picker (alphabetical). */
export function getMediaBrowseConferenceOptions(): MediaBrowseConferenceOption[] {
  return FCS_CONFERENCE_IDS.map((id) => ({
    id,
    name: resolveConferenceBadgeLabel(id) ?? id,
  })).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function isMediaBrowseConferenceId(conferenceId: string | null | undefined): boolean {
  const id = conferenceId?.trim();
  if (!id) return false;
  return (FCS_CONFERENCE_IDS as readonly string[]).includes(id);
}

/**
 * Team picker options: teams referenced by media sources, plus teams from cached ESPN games.
 * Sorted alphabetically by display name.
 */
export function buildMediaBrowseTeamOptions(
  sources: MediaSource[],
  games: EspnNormalizedGame[] = [],
): MediaBrowseTeamOption[] {
  const byId = new Map<string, string>();

  for (const source of sources) {
    for (const teamId of getMediaSourceTeamIds(source)) {
      const label = resolveTeamBadgeLabel(teamId) ?? `Team ${teamId}`;
      if (!byId.has(teamId)) byId.set(teamId, label);
    }
  }

  for (const game of games) {
    addGameTeam(byId, game.awayTeamId, game.awayShortDisplayName ?? game.awayTeam);
    addGameTeam(byId, game.homeTeamId, game.homeShortDisplayName ?? game.homeTeam);
  }

  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function addGameTeam(
  map: Map<string, string>,
  teamId: string | undefined,
  name: string | undefined,
): void {
  const id = teamId?.trim();
  const label = name?.trim();
  if (!id || !isEspnTeamId(id) || !label) return;
  if (!map.has(id)) map.set(id, label);
}

export function filterMediaBrowseTeams(
  teams: MediaBrowseTeamOption[],
  query: string,
): MediaBrowseTeamOption[] {
  const normalized = normalizeTeamName(query);
  if (!normalized) return teams;
  return teams.filter((team) => normalizeTeamName(team.name).includes(normalized));
}

/** True when a source has no team/conference/national metadata useful for browse. */
export function mediaSourceMissingBrowseMetadata(source: MediaSource): boolean {
  return (
    !isMediaSourceNational(source) &&
    getMediaSourceTeamIds(source).length === 0 &&
    getMediaSourceConferenceIds(source).length === 0
  );
}
