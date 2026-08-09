/**
 * Live down-and-distance / field-position from ESPN scoreboard competition.situation.
 * Present on in-progress football scoreboard events; typically omitted for pre/post.
 * No extra network requests — parsed from the same scoreboard payload.
 */

import type { EspnGameSituation, EspnNormalizedGame } from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asIdString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  if (isRecord(value)) {
    return asIdString(value.id) ?? asIdString(value.$ref);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function isNonsenseFragment(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (t === 'unknown' || t.includes('unknown possession')) return true;
  if (/^0th\b/.test(t)) return true;
  if (/^0\s*&/.test(t)) return true;
  if (/^at\s*0\b/.test(t) || t === '0' || t === 'at 0') return true;
  return false;
}

function isValidDownDistanceText(text: string): boolean {
  if (isNonsenseFragment(text)) return false;
  // e.g. "3rd & 10", "1st & Goal", "4th & 2"
  return /\b([1-4](st|nd|rd|th))\s*&\s*(\d+|goal)\b/i.test(text);
}

function isValidPossessionText(text: string): boolean {
  if (isNonsenseFragment(text)) return false;
  // e.g. "IDAHO 45", "MTST 25", "50"
  return /\S/.test(text) && !/^0+$/.test(text.trim());
}

function formatDownOrdinal(down: number): string | undefined {
  switch (down) {
    case 1:
      return '1st';
    case 2:
      return '2nd';
    case 3:
      return '3rd';
    case 4:
      return '4th';
    default:
      return undefined;
  }
}

/** Parse competition.situation from an ESPN scoreboard event. */
export function parseEspnCompetitionSituation(raw: unknown): EspnGameSituation | undefined {
  if (!isRecord(raw)) return undefined;

  const down = asNumber(raw.down);
  const distance = asNumber(raw.distance);
  const yardLine = asNumber(raw.yardLine);
  const downDistanceText = asString(raw.downDistanceText);
  const shortDownDistanceText = asString(raw.shortDownDistanceText);
  const possessionText = asString(raw.possessionText);
  const possessionTeamId = asIdString(raw.possession) ?? asIdString(raw.team);
  const isRedZone = asBoolean(raw.isRedZone);

  if (
    down == null &&
    distance == null &&
    yardLine == null &&
    !downDistanceText &&
    !shortDownDistanceText &&
    !possessionText &&
    !possessionTeamId &&
    isRedZone == null
  ) {
    return undefined;
  }

  return {
    down,
    distance,
    yardLine,
    downDistanceText,
    shortDownDistanceText,
    possessionText,
    possessionTeamId,
    isRedZone,
  };
}

/**
 * Build a concise glanceable line, preferring ESPN display strings.
 * Example: "3rd & 10 at IDAHO 45"
 */
export function buildEspnSituationDisplayText(
  situation: EspnGameSituation,
  options?: { possessionAbbreviation?: string },
): string | undefined {
  const downText =
    (situation.downDistanceText && isValidDownDistanceText(situation.downDistanceText)
      ? situation.downDistanceText
      : undefined) ??
    (situation.shortDownDistanceText && isValidDownDistanceText(situation.shortDownDistanceText)
      ? situation.shortDownDistanceText
      : undefined);

  let resolvedDownText = downText;
  if (!resolvedDownText && situation.down != null && situation.distance != null) {
    const ordinal = formatDownOrdinal(situation.down);
    if (ordinal) {
      // ESPN uses distance 0 for goal-to-go.
      const distancePart = situation.distance === 0 ? 'Goal' : String(situation.distance);
      const candidate = `${ordinal} & ${distancePart}`;
      if (isValidDownDistanceText(candidate)) {
        resolvedDownText = candidate;
      }
    }
  }

  const possession =
    (situation.possessionText && isValidPossessionText(situation.possessionText)
      ? situation.possessionText
      : undefined) ??
    (options?.possessionAbbreviation &&
    situation.yardLine != null &&
    situation.yardLine >= 1 &&
    situation.yardLine <= 50
      ? `${options.possessionAbbreviation} ${situation.yardLine}`
      : undefined);

  // Do not invent midfield/own/opponent from bare yardLine without ESPN possessionText —
  // yardLine orientation is ambiguous without side-of-field context.
  if (!resolvedDownText || !possession) {
    return undefined;
  }

  return `${resolvedDownText} at ${possession}`;
}

function isHalftimeLike(game: Pick<EspnNormalizedGame, 'status' | 'statusShortDetail'>): boolean {
  const haystack = `${game.status ?? ''} ${game.statusShortDetail ?? ''}`.toLowerCase();
  return haystack.includes('halftime') || haystack.trim() === 'ht';
}

/**
 * Situation line for UI — only when game is in progress and data is meaningful.
 * Hidden for scheduled/final/delayed/suspended/postponed/cancelled/halftime.
 */
export function formatEspnGameSituationLine(
  game: Pick<
    EspnNormalizedGame,
    'normalizedStatus' | 'status' | 'statusShortDetail' | 'situation' | 'awayAbbreviation' | 'homeAbbreviation' | 'awayTeamId' | 'homeTeamId'
  >,
): string | undefined {
  if (game.normalizedStatus !== 'in_progress') return undefined;
  if (isHalftimeLike(game)) return undefined;
  if (!game.situation) return undefined;

  const possessionAbbreviation =
    game.situation.possessionTeamId &&
    (game.situation.possessionTeamId === game.awayTeamId
      ? game.awayAbbreviation
      : game.situation.possessionTeamId === game.homeTeamId
        ? game.homeAbbreviation
        : undefined);

  return (
    game.situation.displayText ??
    buildEspnSituationDisplayText(game.situation, { possessionAbbreviation })
  );
}
