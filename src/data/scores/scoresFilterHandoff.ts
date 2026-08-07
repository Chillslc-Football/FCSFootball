/**
 * Reliable Home → Scores filter handoff for tab navigators.
 * Queue a filter before navigating; Scores consumes it once on focus.
 */
import {
  getScoresFilterOption,
  type ScoresFilterId,
} from '@/data/scores/scoresFilters';
import type { Href } from 'expo-router';

export type ScoresFilterHandoff = {
  id: number;
  filterId: ScoresFilterId;
};

let nextHandoffId = 1;
let queued: ScoresFilterHandoff | null = null;
let lastConsumedId = 0;

export function isKnownScoresFilterId(value: string | null | undefined): value is ScoresFilterId {
  if (!value) return false;
  return Boolean(getScoresFilterOption(value as ScoresFilterId));
}

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

/**
 * Queue a consume-once handoff, then return the Scores href.
 * Prefer this for Home Quick Links so tab navigators always receive the filter.
 */
export function prepareScoresFilterNavigation(filterId: ScoresFilterId): Href {
  if (!isKnownScoresFilterId(filterId)) {
    return '/(tabs)/scores';
  }
  queueScoresFilterHandoff(filterId);
  return {
    pathname: '/(tabs)/scores',
    params: { filter: filterId },
  };
}
