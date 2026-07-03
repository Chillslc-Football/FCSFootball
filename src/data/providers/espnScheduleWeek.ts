import type { ScheduleWeekId } from '@/types';

import type { EspnWeekPresetId } from './espnWeekQuery';

export type ScheduleWeekFetchStrategy = 'week_query' | 'date_range';

export type ScheduleWeekConfig = {
  id: ScheduleWeekId;
  label: string;
  fetchStrategy: ScheduleWeekFetchStrategy;
  weekPresetId?: EspnWeekPresetId;
  /**
   * Fallback when ESPN week=0 returns no events.
   * 2026 FCS opening weekend dates verified against ESPN scoreboard API.
   */
  dateRangeIso?: readonly string[];
  fetchNotes: string;
};

/** Schedule screen week presets — Week 1/2 use ESPN week params; Week 0 uses date range. */
export const SCHEDULE_WEEK_CONFIG: Record<ScheduleWeekId, ScheduleWeekConfig> = {
  'week-0': {
    id: 'week-0',
    label: 'Week 0',
    fetchStrategy: 'date_range',
    dateRangeIso: ['2026-08-27', '2026-08-28', '2026-08-29'],
    fetchNotes:
      'ESPN groups=81&seasontype=2&week=0 returns 0 events. Using 2026-08-27 through 2026-08-29 date queries instead.',
  },
  'week-1': {
    id: 'week-1',
    label: 'Week 1',
    fetchStrategy: 'week_query',
    weekPresetId: 'week-1',
    fetchNotes: 'groups=81&seasontype=2&week=1',
  },
  'week-2': {
    id: 'week-2',
    label: 'Week 2',
    fetchStrategy: 'week_query',
    weekPresetId: 'week-2',
    fetchNotes: 'groups=81&seasontype=2&week=2',
  },
};

export const SCHEDULE_WEEK_OPTIONS = (
  Object.values(SCHEDULE_WEEK_CONFIG) as ScheduleWeekConfig[]
).map(({ id, label }) => ({ id, label }));

export function getScheduleWeekConfig(weekId: ScheduleWeekId): ScheduleWeekConfig {
  return SCHEDULE_WEEK_CONFIG[weekId];
}
