import type { ScheduleWeekId } from '@/types';

import { ESPN_SCOREBOARD_BASE } from './espnWeekQuery';
import type { EspnWeekPresetId } from './espnWeekQuery';

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

/** FCS playoffs begin at Week 13 — Weeks 0–12 are regular season. */
export const FCS_PLAYOFF_START_WEEK = 13;

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
  switch (weekNumber) {
    case 13:
      return 'Week 13 • Playoffs';
    case 14:
      return 'Week 14 • Quarterfinals';
    case 15:
      return 'Week 15 • Semifinals';
    case 16:
      return 'Week 16 • National Championship';
    default:
      return `Week ${weekNumber}`;
  }
}

function buildSeasonWeekMeta(weekNumber: number): ScheduleWeekMeta {
  const id = `week-${weekNumber}` as ScheduleWeekId;
  const startDateIso = addDays(SEASON_2026_WEEK1_WEDNESDAY, (weekNumber - 1) * 7);
  const endDateIso = addDays(startDateIso, 4);
  const isPlayoffWeek = weekNumber >= FCS_PLAYOFF_START_WEEK;
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
    return buildSeasonWeekMeta(Number(match[1]));
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

/** ESPN postseason week index: Week 13 → 1, … Week 16 → 4. */
function espnPostseasonWeekIndex(weekNumber: number): number {
  return weekNumber - FCS_PLAYOFF_START_WEEK + 1;
}

function buildPlayoffWeekConfig(meta: ScheduleWeekMeta): ScheduleWeekConfig {
  const postseasonWeek = espnPostseasonWeekIndex(meta.weekNumber);

  return {
    ...meta,
    fetchStrategy: 'week_query',
    scoreboardUrl: `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=3&week=${postseasonWeek}`,
    fetchNotes: `groups=81&seasontype=3&week=${postseasonWeek} (FCS ${meta.title})`,
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
];

function buildScheduleWeekConfig(weekId: ScheduleWeekId): ScheduleWeekConfig {
  const meta = buildWeekMeta(weekId);

  if (weekId === 'week-0') return buildWeek0Config(meta);
  if (meta.isPlayoffWeek) return buildPlayoffWeekConfig(meta);
  return buildRegularSeasonWeekConfig(meta);
}

/** All week configs — shared by Schedule and Scores ESPN fetches. */
export const SCHEDULE_WEEK_CONFIG = Object.fromEntries(
  ALL_SCORES_WEEK_IDS.map((id) => [id, buildScheduleWeekConfig(id)]),
) as Record<ScheduleWeekId, ScheduleWeekConfig>;

/** Schedule screen week selector — limited dev presets. */
export const SCHEDULE_WEEK_OPTIONS: ScheduleWeekOption[] = (
  ['week-0', 'week-1', 'week-2'] as ScheduleWeekId[]
).map((id) => toScheduleWeekOption(id));

/** Scores screen week dropdown — Weeks 0–12 regular season, 13–16 playoffs. */
export const SCORES_WEEK_OPTIONS: ScheduleWeekOption[] = ALL_SCORES_WEEK_IDS.map((id) =>
  toScheduleWeekOption(id),
);

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
