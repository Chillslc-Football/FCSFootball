/**
 * Home → Scores filter handoff for the tab navigator.
 * Queues an existing ScoresFilterId; Scores applies it via setFilterId.
 */
import type { ScoresFilterId } from '@/data/scores/scoresFilters';

export type ScoresFilterHandoff = {
  id: number;
  filterId: ScoresFilterId;
};

let nextHandoffId = 1;
let queued: ScoresFilterHandoff | null = null;
let lastConsumedId = 0;

/** Queue a Scores filter before navigating to the Scores tab. */
export function queueScoresFilterHandoff(filterId: ScoresFilterId): ScoresFilterHandoff {
  const handoff: ScoresFilterHandoff = {
    id: nextHandoffId++,
    filterId,
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
