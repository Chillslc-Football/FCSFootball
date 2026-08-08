import {
  getMediaSourceConferenceIds,
  getMediaSourceTeamIds,
  isMediaSourceNational,
} from '@/data/mediaDirectory/mediaCoverage';
import {
  MONTANA_ESPN_TEAM_ID,
  MONTANA_STATE_ESPN_TEAM_ID,
  MONTANA_STATE_TEAM_NAME,
  MONTANA_TEAM_NAME,
  type MediaSource,
} from '@/data/mediaDirectory/types';

/**
 * Friendly conference labels for media scope badges.
 * Mirrors conferenceList display names without importing that module
 * (conferenceList pulls React Native via dropdown styles).
 */
const CONFERENCE_BADGE_LABELS: Record<string, string> = {
  'big-sky': 'Big Sky',
  'big-south-ovc': 'Big South-OVC',
  caa: 'CAA',
  'fcs-independents': 'FCS Independents',
  'ivy-league': 'Ivy League',
  meac: 'MEAC',
  mvfc: 'Missouri Valley Football Conference',
  nec: 'NEC',
  patriot: 'Patriot League',
  pioneer: 'Pioneer Football League',
  southland: 'Southland',
  southern: 'Southern Conference',
  swac: 'SWAC',
  'united-athletic': 'United Athletic Conference',
};

const TEAM_BADGE_LABELS: Record<string, string> = {
  [MONTANA_STATE_ESPN_TEAM_ID]: MONTANA_STATE_TEAM_NAME,
  [MONTANA_ESPN_TEAM_ID]: MONTANA_TEAM_NAME,
};

export function resolveConferenceBadgeLabel(conferenceId: string): string | null {
  const id = conferenceId.trim();
  if (!id) return null;
  return CONFERENCE_BADGE_LABELS[id] ?? null;
}

export function resolveTeamBadgeLabel(teamId: string): string | null {
  const id = teamId.trim();
  if (!id) return null;
  return TEAM_BADGE_LABELS[id] ?? null;
}

export type MediaBadgeLabels = {
  labels: string[];
  overflowCount: number;
};

const DEFAULT_MAX_BADGES = 3;

/**
 * Build compact coverage badges: National, team names, conference names.
 * Caps at `maxBadges` and reports overflow for “+N more”.
 */
export function resolveMediaScopeBadges(
  source: MediaSource,
  options?: { maxBadges?: number },
): MediaBadgeLabels {
  const maxBadges = options?.maxBadges ?? DEFAULT_MAX_BADGES;
  const labels: string[] = [];

  if (isMediaSourceNational(source)) {
    labels.push('National');
  }

  for (const teamId of getMediaSourceTeamIds(source)) {
    const label = resolveTeamBadgeLabel(teamId);
    if (label && !labels.includes(label)) labels.push(label);
  }

  for (const conferenceId of getMediaSourceConferenceIds(source)) {
    const label = resolveConferenceBadgeLabel(conferenceId);
    if (label && !labels.includes(label)) labels.push(label);
  }

  if (labels.length === 0) {
    return { labels: [], overflowCount: 0 };
  }

  if (labels.length <= maxBadges) {
    return { labels, overflowCount: 0 };
  }

  return {
    labels: labels.slice(0, maxBadges),
    overflowCount: labels.length - maxBadges,
  };
}

/** One-line coverage summary for directory rows and detail headers. */
export function formatMediaCoverageSummary(
  source: MediaSource,
  options?: { maxBadges?: number },
): string | null {
  const { labels, overflowCount } = resolveMediaScopeBadges(source, options);
  if (labels.length === 0) return null;
  const base = labels.join(' · ');
  return overflowCount > 0 ? `${base} · +${overflowCount} more` : base;
}

/** @deprecated Prefer resolveMediaScopeBadges for multi-coverage. */
export function resolveMediaScopeBadge(source: MediaSource): string {
  const { labels } = resolveMediaScopeBadges(source, { maxBadges: 1 });
  return labels[0] ?? 'Coverage';
}
