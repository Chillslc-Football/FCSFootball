import type { EspnNormalizedGame, Game } from '@/types';

export type EspnNormalizedGameStatus = NonNullable<EspnNormalizedGame['normalizedStatus']>;

/** ESPN status.type.name values confirmed in-app (STATUS_HALFTIME) or standard ESPN scoreboard enums. */
const SPECIAL_STATUS_BY_NAME: Record<string, EspnNormalizedGameStatus> = {
  STATUS_DELAY: 'delayed',
  STATUS_RAIN_DELAY: 'delayed',
  STATUS_DELAYED: 'delayed',
  STATUS_POSTPONED: 'postponed',
  STATUS_CANCELED: 'cancelled',
  STATUS_CANCELLED: 'cancelled',
  STATUS_SUSPENDED: 'suspended',
  STATUS_HALFTIME: 'in_progress',
  STATUS_END_PERIOD: 'in_progress',
  STATUS_IN_PROGRESS: 'in_progress',
  STATUS_SCHEDULED: 'scheduled',
  STATUS_FINAL: 'final',
  STATUS_FINAL_OVERTIME: 'final',
};

/**
 * Map ESPN status.type.state + type.name (+ description fallback) to app normalized status.
 * Special names win over raw pre/in/post so postponed/cancelled are not treated as final.
 */
export function mapEspnStatusToNormalized(options: {
  state?: string;
  typeName?: string;
  description?: string;
}): Game['status'] | undefined {
  const typeName = options.typeName?.trim().toUpperCase() ?? '';
  const description = options.description?.trim() ?? '';
  const descriptionKey = description.toLowerCase();

  if (typeName && SPECIAL_STATUS_BY_NAME[typeName]) {
    return SPECIAL_STATUS_BY_NAME[typeName];
  }

  // Description fallbacks when type.name is missing/unknown (do not invent unsupported codes).
  if (/\bpostponed\b/.test(descriptionKey)) return 'postponed';
  if (/\bsuspended\b/.test(descriptionKey)) return 'suspended';
  if (/\bcancelled\b|\bcanceled\b/.test(descriptionKey)) return 'cancelled';
  if (/\bweather delay\b/.test(descriptionKey) || /\bdelayed\b/.test(descriptionKey)) {
    return 'delayed';
  }
  if (/\bhalftime\b/.test(descriptionKey) || descriptionKey === 'ht') return 'in_progress';

  switch (options.state) {
    case 'pre':
      return 'scheduled';
    case 'in':
      return 'in_progress';
    case 'post':
      // Bare post without a special name → completed game.
      return 'final';
    default:
      return undefined;
  }
}

/** Label for UI: prefer ESPN description/shortDetail when present. */
export function formatEspnGameStatusLabel(game: Pick<
  EspnNormalizedGame,
  'status' | 'statusShortDetail' | 'normalizedStatus'
>): string {
  const espn = game.status?.trim();
  if (espn && espn.toLowerCase() !== 'unknown') {
    return espn;
  }

  switch (game.normalizedStatus) {
    case 'delayed':
      return 'Delayed';
    case 'postponed':
      return 'Postponed';
    case 'suspended':
      return 'Suspended';
    case 'cancelled':
      return 'Cancelled';
    case 'final':
      return 'Final';
    case 'in_progress':
      return game.statusShortDetail?.trim() || 'In Progress';
    case 'scheduled':
      return 'Scheduled';
    default:
      return game.statusShortDetail?.trim() || 'Status TBD';
  }
}

/** Continue foreground 30s live polling for these statuses. */
export function shouldPollEspnNormalizedStatus(
  status: EspnNormalizedGame['normalizedStatus'],
): boolean {
  return status === 'in_progress' || status === 'delayed' || status === 'suspended';
}

export function isTerminalEspnNormalizedStatus(
  status: EspnNormalizedGame['normalizedStatus'],
): boolean {
  return status === 'final' || status === 'cancelled';
}

export function isInterruptedEspnNormalizedStatus(
  status: EspnNormalizedGame['normalizedStatus'],
): boolean {
  return (
    status === 'delayed' ||
    status === 'postponed' ||
    status === 'suspended' ||
    status === 'cancelled'
  );
}

/** Left-rail / meta presentation for scoreboard-style cards. */
export function resolveEspnGameStatusPresentation(game: EspnNormalizedGame): {
  kind: 'live' | 'final' | 'special' | 'kickoff';
  label: string;
} {
  switch (game.normalizedStatus) {
    case 'in_progress':
      // Keep ESPN quarter/clock/halftime/OT text as-is.
      return { kind: 'live', label: game.status?.trim() || 'In Progress' };
    case 'delayed':
    case 'suspended':
      return { kind: 'live', label: formatEspnGameStatusLabel(game) };
    case 'final':
      return { kind: 'final', label: formatEspnGameStatusLabel(game) };
    case 'postponed':
    case 'cancelled':
      return { kind: 'special', label: formatEspnGameStatusLabel(game) };
    default:
      return { kind: 'kickoff', label: '' };
  }
}
