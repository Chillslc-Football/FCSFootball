/**
 * Pure notification transition rules mirroring poll-espn-games Edge Function semantics.
 * Used for developer/unit tests only — does not send Expo pushes.
 *
 * Keep in sync with supabase/functions/poll-espn-games/index.ts transition checks.
 */

export type NotificationTransitionSnapshot = {
  state: string | null;
  statusName: string | null;
  period: number | null;
  awayScore: number | null;
  homeScore: number | null;
};

export type NotificationTransitionType =
  | 'game_start'
  | 'quarter_end'
  | 'halftime'
  | 'final'
  | 'score';

export type DetectedNotificationTransition = {
  type: NotificationTransitionType;
  dedupeKey: string;
};

function isCompletedFinal(state: string | null, statusName: string | null): boolean {
  if (state !== 'post') return false;
  const upper = (statusName ?? '').toUpperCase();
  if (upper.includes('POSTPONED')) return false;
  if (upper.includes('CANCELED') || upper.includes('CANCELLED')) return false;
  if (upper.includes('SUSPENDED')) return false;
  return true;
}

/**
 * Detect push-worthy transitions between two monitored-game snapshots.
 * Score events require explicit scoring-play ids (same as Edge Function).
 */
export function detectEspnNotificationTransitions(options: {
  eventId: string;
  prior: NotificationTransitionSnapshot | null;
  current: NotificationTransitionSnapshot;
  scoringPlayIds?: string[];
}): DetectedNotificationTransition[] {
  const { eventId, prior, current } = options;
  const priorState = prior?.state ?? null;
  const priorPeriod = prior?.period ?? null;
  const priorStatusName = prior?.statusName ?? null;
  const pending: DetectedNotificationTransition[] = [];

  if (priorState !== 'in' && current.state === 'in') {
    pending.push({ type: 'game_start', dedupeKey: `${eventId}:start` });
  }

  if (
    priorPeriod === 1 &&
    current.period === 2 &&
    priorStatusName !== 'STATUS_HALFTIME' &&
    current.statusName !== 'STATUS_HALFTIME'
  ) {
    pending.push({ type: 'quarter_end', dedupeKey: `${eventId}:period:1:end` });
  }

  if (current.statusName === 'STATUS_HALFTIME' && priorStatusName !== 'STATUS_HALFTIME') {
    pending.push({ type: 'halftime', dedupeKey: `${eventId}:halftime` });
  }

  if (priorPeriod === 3 && current.period === 4) {
    pending.push({ type: 'quarter_end', dedupeKey: `${eventId}:period:3:end` });
  }

  if (priorState !== 'post' && isCompletedFinal(current.state, current.statusName)) {
    pending.push({ type: 'final', dedupeKey: `${eventId}:final` });
  }

  for (const playId of options.scoringPlayIds ?? []) {
    pending.push({ type: 'score', dedupeKey: `${eventId}:score:${playId}` });
  }

  return pending;
}

/** Unique dedupe keys — second identical score/final must not emit again. */
export function filterNewNotificationTransitions(
  detected: DetectedNotificationTransition[],
  alreadySentDedupeKeys: Set<string>,
): DetectedNotificationTransition[] {
  return detected.filter((item) => !alreadySentDedupeKeys.has(item.dedupeKey));
}
