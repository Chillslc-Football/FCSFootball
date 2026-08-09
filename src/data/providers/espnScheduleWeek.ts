import type { ScheduleWeekId } from '@/types';

import { ESPN_SCOREBOARD_BASE } from './espnWeekQuery';
import type { EspnScoreboardGroupId, EspnWeekPresetId } from './espnWeekQuery';
import { ESPN_SCOREBOARD_GROUP_FCS } from './espnWeekQuery';

export type ScheduleWeekFetchStrategy = 'week_query' | 'date_range';

/** College football week window — Wed start through Sun end. */
export type ScheduleWeekMeta = {
  id: ScheduleWeekId;
  weekNumber: number;
  /** Short title without dates, e.g. "Week 1" or "Week 13 • Playoffs". */
  title: string;
  startDateIso: string;
  endDateIso: string;
  isPlayoffWeek: boolean;
  /** UI label with date range, e.g. "Week 1 • Sep 2 – Sep 6". */
  displayLabel: string;
};

export type ScheduleWeekConfig = ScheduleWeekMeta & {
  fetchStrategy: ScheduleWeekFetchStrategy;
  weekPresetId?: EspnWeekPresetId;
  /** Direct ESPN scoreboard URL — preferred for week_query when set. */
  scoreboardUrl?: string;
  /**
   * Fallback when ESPN week=0 returns no events.
   * 2026 FCS opening weekend dates verified against ESPN scoreboard API.
   */
  dateRangeIso?: readonly string[];
  fetchNotes: string;
};

/** @deprecated Use displayLabel — kept for callers expecting plain title. */
export type ScheduleWeekOption = {
  id: ScheduleWeekId;
  label: string;
  displayLabel: string;
};

/** FCS playoffs begin at ESPN week 13. */
export const FCS_PLAYOFF_START_WEEK = 13;

/** FCS playoffs span ESPN weeks 13–17 on the Scores tab. */
export const FCS_PLAYOFF_END_WEEK = 17;

/** National Championship — Jan 11 (outside regular-season calendar window). */
const NATIONAL_CHAMPIONSHIP_DATE = '2027-01-11';

/** Scores tab playoff dropdown labels (ESPN week number → display title). */
const SCORES_PLAYOFF_DISPLAY_TITLES: Record<number, string> = {
  13: 'Playoffs Round 1',
  14: 'Playoffs Round 2',
  15: 'Quarterfinals',
  16: 'Semifinals',
  17: 'National Championship',
};

/** 2026 FCS season — Week 1 college week starts Wednesday Sep 2. */
const SEASON_2026_WEEK1_WEDNESDAY = '2026-09-02';

const WEEK_0_DATES = {
  startDateIso: '2026-08-27',
  endDateIso: '2026-08-29',
} as const;

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Format Wed–Sun range as "Sep 2 – Sep 6" (cross-month when needed). */
export function formatCollegeWeekDateRange(startDateIso: string, endDateIso: string): string {
  const start = parseIsoDate(startDateIso);
  const end = parseIsoDate(endDateIso);

  const startMonth = start.toLocaleDateString(undefined, { month: 'short' });
  const endMonth = end.toLocaleDateString(undefined, { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}`;
  }

  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

export function formatWeekDisplayLabel(
  title: string,
  startDateIso: string,
  endDateIso: string,
): string {
  return `${title} • ${formatCollegeWeekDateRange(startDateIso, endDateIso)}`;
}

function buildSeasonWeekTitle(weekNumber: number): string {
  return `Week ${weekNumber}`;
}

function buildNationalChampionshipMeta(): ScheduleWeekMeta {
  const title = 'Week 17';
  const startDateIso = '2027-01-07';
  const endDateIso = NATIONAL_CHAMPIONSHIP_DATE;

  return {
    id: 'week-17',
    weekNumber: 17,
    title,
    startDateIso,
    endDateIso,
    isPlayoffWeek: true,
    displayLabel: formatWeekDisplayLabel(title, startDateIso, endDateIso),
  };
}

function buildSeasonWeekMeta(weekNumber: number): ScheduleWeekMeta {
  if (weekNumber === 17) {
    return buildNationalChampionshipMeta();
  }

  const id = `week-${weekNumber}` as ScheduleWeekId;
  const startDateIso = addDays(SEASON_2026_WEEK1_WEDNESDAY, (weekNumber - 1) * 7);
  const endDateIso = addDays(startDateIso, 4);
  const isPlayoffWeek =
    weekNumber >= FCS_PLAYOFF_START_WEEK && weekNumber <= FCS_PLAYOFF_END_WEEK;
  const title = buildSeasonWeekTitle(weekNumber);

  return {
    id,
    weekNumber,
    title,
    startDateIso,
    endDateIso,
    isPlayoffWeek,
    displayLabel: formatWeekDisplayLabel(title, startDateIso, endDateIso),
  };
}

function buildWeek0Meta(): ScheduleWeekMeta {
  const title = 'Week 0';
  const { startDateIso, endDateIso } = WEEK_0_DATES;

  return {
    id: 'week-0',
    weekNumber: 0,
    title,
    startDateIso,
    endDateIso,
    isPlayoffWeek: false,
    displayLabel: formatWeekDisplayLabel(title, startDateIso, endDateIso),
  };
}

const WEEK_0_META = buildWeek0Meta();

function buildWeekMeta(weekId: ScheduleWeekId): ScheduleWeekMeta {
  if (weekId === 'week-0') return WEEK_0_META;

  const match = /^week-(\d+)$/.exec(weekId);
  if (match) {
    const weekNumber = Number(match[1]);
    const meta = buildSeasonWeekMeta(weekNumber);

    if (weekNumber === 1) {
      return {
        ...meta,
        title: 'Week 1',
        startDateIso: WEEK_0_DATES.startDateIso,
        displayLabel: formatWeekDisplayLabel(
          'Week 1',
          WEEK_0_DATES.startDateIso,
          meta.endDateIso,
        ),
      };
    }

    return meta;
  }

  throw new Error(`Unknown schedule week id: ${weekId}`);
}

function buildWeek0Config(meta: ScheduleWeekMeta): ScheduleWeekConfig {
  return {
    ...meta,
    fetchStrategy: 'date_range',
    dateRangeIso: ['2026-08-27', '2026-08-28', '2026-08-29'],
    fetchNotes:
      'ESPN groups=81&seasontype=2&week=0 returns 0 events. Using 2026-08-27 through 2026-08-29 date queries instead.',
  };
}

function buildRegularSeasonWeekConfig(meta: ScheduleWeekMeta): ScheduleWeekConfig {
  return {
    ...meta,
    fetchStrategy: 'week_query',
    scoreboardUrl: `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=2&week=${meta.weekNumber}`,
    fetchNotes: `groups=81&seasontype=2&week=${meta.weekNumber}`,
  };
}

/** ESPN FCS playoff weeks use seasontype=2 with week=13…17. */
function buildPlayoffWeekConfig(meta: ScheduleWeekMeta): ScheduleWeekConfig {
  return {
    ...meta,
    fetchStrategy: 'week_query',
    scoreboardUrl: `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=2&week=${meta.weekNumber}`,
    fetchNotes: `groups=81&seasontype=2&week=${meta.weekNumber}`,
  };
}

function buildNationalChampionshipConfig(meta: ScheduleWeekMeta): ScheduleWeekConfig {
  return {
    ...buildPlayoffWeekConfig(meta),
    dateRangeIso: [NATIONAL_CHAMPIONSHIP_DATE],
    fetchNotes: `groups=81&seasontype=2&week=17 with ${NATIONAL_CHAMPIONSHIP_DATE} date fallback`,
  };
}

const ALL_SCORES_WEEK_IDS: ScheduleWeekId[] = [
  'week-0',
  'week-1',
  'week-2',
  'week-3',
  'week-4',
  'week-5',
  'week-6',
  'week-7',
  'week-8',
  'week-9',
  'week-10',
  'week-11',
  'week-12',
  'week-13',
  'week-14',
  'week-15',
  'week-16',
  'week-17',
];

function buildScheduleWeekConfig(weekId: ScheduleWeekId): ScheduleWeekConfig {
  const meta = buildWeekMeta(weekId);

  if (weekId === 'week-0') return buildWeek0Config(meta);
  if (weekId === 'week-17') return buildNationalChampionshipConfig(meta);
  if (meta.isPlayoffWeek) return buildPlayoffWeekConfig(meta);
  return buildRegularSeasonWeekConfig(meta);
}

/** All week configs — shared by Schedule and Scores ESPN fetches. */
export const SCHEDULE_WEEK_CONFIG = Object.fromEntries(
  ALL_SCORES_WEEK_IDS.map((id) => [id, buildScheduleWeekConfig(id)]),
) as Record<ScheduleWeekId, ScheduleWeekConfig>;

/** Visible week ids — Week 0 is merged into Week 1. */
export const VISIBLE_SCORES_WEEK_IDS: ScheduleWeekId[] = ALL_SCORES_WEEK_IDS.filter(
  (id) => id !== 'week-0',
);

/** ESPN source weeks fetched for a visible week selection. */
export function resolveEspnSourceWeekIds(weekId: ScheduleWeekId): ScheduleWeekId[] {
  if (weekId === 'week-1') return ['week-0', 'week-1'];
  return [weekId];
}

/** Schedule screen week selector — limited dev presets. */
export const SCHEDULE_WEEK_OPTIONS: ScheduleWeekOption[] = (
  ['week-1', 'week-2'] as ScheduleWeekId[]
).map((id) => toScheduleWeekOption(id));

/** Scores tab title — playoff rounds use friendly labels. */
export function getScoresWeekTitle(weekId: ScheduleWeekId): string {
  const match = /^week-(\d+)$/.exec(weekId);
  if (match) {
    const weekNumber = Number(match[1]);
    const playoffTitle = SCORES_PLAYOFF_DISPLAY_TITLES[weekNumber];
    if (playoffTitle) return playoffTitle;
  }

  return getScheduleWeekConfig(weekId).title;
}

/** Scores tab dropdown label including date range. */
export function getScoresWeekDisplayLabel(weekId: ScheduleWeekId): string {
  const config = getScheduleWeekConfig(weekId);
  const title = getScoresWeekTitle(weekId);
  return formatWeekDisplayLabel(title, config.startDateIso, config.endDateIso);
}

/** Scores screen week dropdown — Week 1 includes ESPN weeks 0+1; Week 0 hidden. */
export const SCORES_WEEK_OPTIONS: ScheduleWeekOption[] = VISIBLE_SCORES_WEEK_IDS.map((id) =>
  toScoresWeekOption(id),
);

function toScoresWeekOption(id: ScheduleWeekId): ScheduleWeekOption {
  const title = getScoresWeekTitle(id);
  const displayLabel = getScoresWeekDisplayLabel(id);
  return { id, label: title, displayLabel };
}

function toScheduleWeekOption(id: ScheduleWeekId): ScheduleWeekOption {
  const config = SCHEDULE_WEEK_CONFIG[id];
  return {
    id,
    label: config.title,
    displayLabel: config.displayLabel,
  };
}

export function getScheduleWeekConfig(weekId: ScheduleWeekId): ScheduleWeekConfig {
  return SCHEDULE_WEEK_CONFIG[weekId];
}

/** Same week calendar as FCS, but with groups=80 for the FBS scoreboard feed. */
export function getScheduleWeekConfigForGroup(
  weekId: ScheduleWeekId,
  groupId: EspnScoreboardGroupId,
): ScheduleWeekConfig {
  if (groupId === ESPN_SCOREBOARD_GROUP_FCS) {
    return getScheduleWeekConfig(weekId);
  }

  const base = getScheduleWeekConfig(weekId);
  const scoreboardUrl = base.scoreboardUrl?.replace(
    `groups=${ESPN_SCOREBOARD_GROUP_FCS}`,
    `groups=${groupId}`,
  );
  const fetchNotes = base.fetchNotes.replaceAll(
    `groups=${ESPN_SCOREBOARD_GROUP_FCS}`,
    `groups=${groupId}`,
  );
  const dateRangeIso = weekId === 'week-17' ? undefined : base.dateRangeIso;

  return {
    ...base,
    scoreboardUrl,
    fetchNotes,
    dateRangeIso,
  };
}

export function getScheduleWeekMeta(weekId: ScheduleWeekId): ScheduleWeekMeta {
  const { id, weekNumber, title, startDateIso, endDateIso, isPlayoffWeek, displayLabel } =
    getScheduleWeekConfig(weekId);
  return { id, weekNumber, title, startDateIso, endDateIso, isPlayoffWeek, displayLabel };
}

/** Full dropdown label including date range. */
export function getScheduleWeekLabel(weekId: ScheduleWeekId): string {
  return getScheduleWeekConfig(weekId).displayLabel;
}

export function getScheduleWeekScoreboardUrl(weekId: ScheduleWeekId): string | undefined {
  const config = getScheduleWeekConfig(weekId);
  return config.scoreboardUrl;
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resolve the Scores tab's default week from the existing 2026 FCS calendar.
 * Uses VISIBLE_SCORES_WEEK_IDS date windows (Week 1 includes Week 0 dates; playoffs 13–17).
 *
 * Fallbacks (no invented dates):
 * - Before Week 1 window → week-1 (same as prior hardcoded default)
 * - After National Championship window → week-17
 * - Mon–Tue gaps between Wed–Sun windows → upcoming week
 */
export function resolveCurrentScoresWeekId(now: Date = new Date()): ScheduleWeekId {
  const todayIso = toLocalIsoDate(now);

  for (const id of VISIBLE_SCORES_WEEK_IDS) {
    const meta = getScheduleWeekMeta(id);
    if (todayIso >= meta.startDateIso && todayIso <= meta.endDateIso) {
      return id;
    }
  }

  const week1 = getScheduleWeekMeta('week-1');
  if (todayIso < week1.startDateIso) {
    return 'week-1';
  }

  const championship = getScheduleWeekMeta('week-17');
  if (todayIso > championship.endDateIso) {
    return 'week-17';
  }

  for (const id of VISIBLE_SCORES_WEEK_IDS) {
    const meta = getScheduleWeekMeta(id);
    if (todayIso < meta.startDateIso) {
      return id;
    }
  }

  return 'week-17';
}
