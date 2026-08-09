/**
 * Home → Scores navigation handoff for the tab navigator.
 * Queues an optional filter and/or explicit week; Scores consumes once on focus.
 */
import type { ScoresFilterId } from '@/data/scores/scoresFilters';
import type { ScheduleWeekId } from '@/types';

export type ScoresFilterHandoff = {
  id: number;
  filterId?: ScoresFilterId;
  /** When set, Scores uses this week instead of resolving the current week. */
  weekId?: ScheduleWeekId;
};

let nextHandoffId = 1;
let queued: ScoresFilterHandoff | null = null;
let lastConsumedId = 0;

/** Queue a Scores filter before navigating to the Scores tab. */
export function queueScoresFilterHandoff(
  filterId: ScoresFilterId,
  options?: { weekId?: ScheduleWeekId },
): ScoresFilterHandoff {
  const handoff: ScoresFilterHandoff = {
    id: nextHandoffId++,
    filterId,
    weekId: options?.weekId,
  };
  queued = handoff;
  return handoff;
}

/** Queue an explicit Scores week (optional filter) — wins over current-week default. */
export function queueScoresWeekHandoff(
  weekId: ScheduleWeekId,
  options?: { filterId?: ScoresFilterId },
): ScoresFilterHandoff {
  const handoff: ScoresFilterHandoff = {
    id: nextHandoffId++,
    weekId,
    filterId: options?.filterId,
  };
  queued = handoff;
  return handoff;
}

/** Consume the queued handoff exactly once. */
export function takeScoresFilterHandoff(): ScoresFilterHandoff | null {
  if (!queued || queued.id === lastConsumedId) return null;
  lastConsumedId = queued.id;
  const value = queued;
  queued = null;
  return value;
}

/** Test helper — reset module state between cases. */
export function resetScoresFilterHandoffForTests(): void {
  queued = null;
  lastConsumedId = 0;
  nextHandoffId = 1;
}
