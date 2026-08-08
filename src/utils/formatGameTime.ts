import type { GameStatus } from '@/types';

/** Eastern Time — used only when formatting ISO startTime fallback. */
const ESPN_KICKOFF_TIMEZONE = 'America/New_York';

/** Device timezone from Intl — used by dev diagnostics only. */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'unknown';
  }
}

export type EspnKickoffDisplaySource = {
  displayTime?: string;
  statusShortDetail?: string;
  statusDetail?: string;
  startTime?: string;
  /** Legacy/mock preformatted kickoff string */
  time?: string;
};

function isIsoDateTimeString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value.trim());
}

function hasTimezoneLabel(value: string): boolean {
  return /\b(ET|EDT|EST|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT)\b/i.test(value);
}

function appendEtIfNeeded(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === 'TBD') return 'TBD';
  if (hasTimezoneLabel(trimmed)) return trimmed;
  return `${trimmed} ET`;
}

function isEspnListedTimeTbd(value?: string): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'TBD') return true;
  if (/\bTBD\b/.test(upper) && !/\d{1,2}:\d{2}/.test(trimmed)) return true;
  return false;
}

function looksLikeKickoffClock(value?: string): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  if (isEspnListedTimeTbd(trimmed)) return false;
  return /\d{1,2}:\d{2}/.test(trimmed) && /\b(AM|PM)\b/i.test(trimmed);
}

function extractTimeFromShortDetail(shortDetail?: string): string | undefined {
  if (!shortDetail?.trim() || isEspnListedTimeTbd(shortDetail)) return undefined;
  const trimmed = shortDetail.trim();

  const dashParts = trimmed.split(/\s[-–—]\s/);
  if (dashParts.length >= 2) {
    const timePart = dashParts[dashParts.length - 1]?.trim();
    if (timePart && !isEspnListedTimeTbd(timePart) && looksLikeKickoffClock(timePart)) {
      return timePart;
    }
  }

  if (looksLikeKickoffClock(trimmed)) return trimmed;

  return undefined;
}

function extractTimeFromDetail(detail?: string): string | undefined {
  if (!detail?.trim() || isEspnListedTimeTbd(detail)) return undefined;
  const atMatch = /\s at\s+(.+)$/i.exec(detail.trim());
  if (atMatch?.[1]) {
    const timePart = atMatch[1].trim();
    if (!isEspnListedTimeTbd(timePart)) return timePart;
  }
  return extractTimeFromShortDetail(detail);
}

function extractDateFromDetail(detail?: string): string | undefined {
  if (!detail?.trim() || isEspnListedTimeTbd(detail)) return undefined;
  const atIndex = detail.indexOf(' at ');
  if (atIndex > 0) return detail.slice(0, atIndex).trim();
  return undefined;
}

function extractDateFromShortDetail(shortDetail?: string): string | undefined {
  if (!shortDetail?.trim() || isEspnListedTimeTbd(shortDetail)) return undefined;
  const dashParts = shortDetail.trim().split(/\s[-–—]\s/);
  if (dashParts.length >= 2) {
    const datePart = dashParts[0]?.trim();
    if (datePart) return datePart;
  }
  return undefined;
}

function resolveEspnKickoffFields(
  source: EspnKickoffDisplaySource | string | undefined,
): EspnKickoffDisplaySource {
  if (source == null) return {};
  if (typeof source === 'string') {
    return { startTime: source };
  }
  return source;
}

/** Parse ESPN kickoff ISO into a Date — used for sorting/grouping and ET fallback. */
export function parseGameStartTime(startTime: string | undefined): Date | null {
  if (!startTime?.trim() || startTime.trim() === 'TBD') return null;

  try {
    const trimmed = startTime.trim();
    const normalized =
      /Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)
        ? trimmed.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})Z$/i, '$1:00.000Z')
        : trimmed;
    const ms = Date.parse(normalized);
    if (Number.isNaN(ms)) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

function formatIsoStartTimeEastern(startTime?: string): string | undefined {
  if (!startTime?.trim() || startTime.trim() === 'TBD') return undefined;
  if (!isIsoDateTimeString(startTime.trim())) return undefined;

  const instant = parseGameStartTime(startTime);
  if (!instant || Number.isNaN(instant.getTime())) return undefined;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ESPN_KICKOFF_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(instant);

    const hour = parts.find((part) => part.type === 'hour')?.value;
    const minute = parts.find((part) => part.type === 'minute')?.value;
    const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value?.toUpperCase();

    if (hour && minute && (dayPeriod === 'AM' || dayPeriod === 'PM')) {
      return `${Number(hour)}:${minute} ${dayPeriod} ET`;
    }

    return appendEtIfNeeded(
      new Intl.DateTimeFormat('en-US', {
        timeZone: ESPN_KICKOFF_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(instant),
    );
  } catch {
    return undefined;
  }
}

function formatIsoStartDateEastern(startTime?: string): string | undefined {
  if (!startTime?.trim() || !isIsoDateTimeString(startTime.trim())) return undefined;

  const instant = parseGameStartTime(startTime);
  if (!instant || Number.isNaN(instant.getTime())) return undefined;

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: ESPN_KICKOFF_TIMEZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(instant);
  } catch {
    return undefined;
  }
}

/**
 * Kickoff time for display.
 * Prefers ESPN status display strings; falls back to ISO startTime in Eastern Time.
 */
export function formatGameKickoffTime(
  source: EspnKickoffDisplaySource | string | undefined,
): string {
  try {
    const fields = resolveEspnKickoffFields(source);

    const direct = fields.displayTime?.trim();
    if (direct && !isEspnListedTimeTbd(direct)) {
      return appendEtIfNeeded(direct);
    }

    const fromShort = extractTimeFromShortDetail(fields.statusShortDetail);
    if (fromShort) return appendEtIfNeeded(fromShort);

    const fromDetail = extractTimeFromDetail(fields.statusDetail);
    if (fromDetail) return appendEtIfNeeded(fromDetail);

    const legacyTime = fields.time?.trim();
    if (legacyTime && !isEspnListedTimeTbd(legacyTime)) {
      if (looksLikeKickoffClock(legacyTime) || !isIsoDateTimeString(legacyTime)) {
        return appendEtIfNeeded(legacyTime);
      }
    }

    const espnMarkedTbd =
      isEspnListedTimeTbd(fields.statusShortDetail) ||
      isEspnListedTimeTbd(fields.statusDetail);

    if (espnMarkedTbd) {
      return 'TBD';
    }

    const fromIso = formatIsoStartTimeEastern(fields.startTime);
    if (fromIso) return fromIso;

    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (!trimmed || trimmed === 'TBD') return 'TBD';
      if (!isIsoDateTimeString(trimmed)) return appendEtIfNeeded(trimmed);
    }

    return 'TBD';
  } catch (error) {
    console.warn('[formatGameKickoffTime] failed:', error);
    return 'TBD';
  }
}

/** Game date as ESPN lists it, with ISO Eastern fallback. */
export function formatGameKickoffDate(
  source: EspnKickoffDisplaySource | string | undefined,
): string {
  try {
    const fields = resolveEspnKickoffFields(source);

    const fromDetail = extractDateFromDetail(fields.statusDetail);
    if (fromDetail) return fromDetail;

    const fromShort = extractDateFromShortDetail(fields.statusShortDetail);
    if (fromShort) return fromShort;

    const fromIso = formatIsoStartDateEastern(fields.startTime);
    if (fromIso) return fromIso;

    if (fields.startTime && isIsoDateTimeString(fields.startTime)) {
      return formatGameDateLabel(fields.startTime.slice(0, 10));
    }

    if (typeof source === 'string' && source.trim() && !isIsoDateTimeString(source.trim())) {
      return source.trim();
    }

    return 'TBD';
  } catch {
    return 'TBD';
  }
}

/** Date + time using ESPN-provided strings with ISO fallback. */
export function formatGameKickoffDateTime(
  source: EspnKickoffDisplaySource | string | undefined,
): string {
  const datePart = formatGameKickoffDate(source);
  const timePart = formatGameKickoffTime(source);

  if (datePart === 'TBD' && timePart === 'TBD') return 'TBD';
  if (datePart === 'TBD') return timePart;
  if (timePart === 'TBD') return datePart;
  return `${datePart} • ${timePart}`;
}

const MONTH_LONG_TO_SHORT: Record<string, string> = {
  January: 'Jan',
  February: 'Feb',
  March: 'Mar',
  April: 'Apr',
  May: 'May',
  June: 'Jun',
  July: 'Jul',
  August: 'Aug',
  September: 'Sep',
  October: 'Oct',
  November: 'Nov',
  December: 'Dec',
};

/** Favorites upcoming kickoff only — compact display; does not change shared formatters. */
export function formatFavoriteUpcomingKickoff(
  source: EspnKickoffDisplaySource | string | undefined,
): string {
  const dateRaw = formatGameKickoffDate(source);
  const timeRaw = formatGameKickoffTime(source);

  if (dateRaw === 'TBD' && timeRaw === 'TBD') return 'TBD';

  const datePart =
    dateRaw === 'TBD'
      ? dateRaw
      : dateRaw
          .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
          .replace(
            /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
            (month) => MONTH_LONG_TO_SHORT[month] ?? month,
          );

  const timePart =
    timeRaw === 'TBD' ? timeRaw : timeRaw.replace(/\b(EDT|EST)\b/gi, 'ET');

  if (datePart === 'TBD') return timePart;
  if (timePart === 'TBD') return datePart;
  return `${datePart} • ${timePart}`;
}

/** Detailed kickoff label — same as formatGameKickoffDateTime. */
export function formatGameKickoffDateTimeDetailed(
  source: EspnKickoffDisplaySource | string | undefined,
): string {
  return formatGameKickoffDateTime(source);
}

/** YYYY-MM-DD calendar key for grouping schedule days (from ISO startTime). */
export function extractLocalGameDateIso(startTime: string): string {
  try {
    if (!startTime?.trim() || startTime.trim() === 'TBD') return 'unknown';

    if (isIsoDateTimeString(startTime)) {
      const instant = parseGameStartTime(startTime);
      if (instant) {
        try {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: ESPN_KICKOFF_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).formatToParts(instant);
          const get = (type: Intl.DateTimeFormatPartTypes) =>
            parts.find((part) => part.type === type)?.value ?? '00';
          return `${get('year')}-${get('month')}-${get('day')}`;
        } catch {
          return startTime.slice(0, 10);
        }
      }
      return startTime.slice(0, 10);
    }

    const date = parseGameStartTime(startTime);
    if (!date || Number.isNaN(date.getTime())) return 'unknown';

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('[extractLocalGameDateIso] failed:', startTime, error);
    return 'unknown';
  }
}

/** Section header label for a schedule date key (YYYY-MM-DD). */
export function formatGameDateLabel(isoDate: string): string {
  if (isoDate === 'unknown') return 'Date TBD';

  const parsed = Date.parse(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(parsed)) return isoDate;

  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(parsed));
  } catch {
    return isoDate;
  }
}

/** Right-rail / header status: ESPN kickoff when upcoming, ESPN status otherwise. */
export function formatGameStatusDetail(options: {
  startTime?: string;
  displayTime?: string;
  statusShortDetail?: string;
  statusDetail?: string;
  time?: string;
  status: GameStatus;
  espnStatus: string;
  fallback?: string;
}): string {
  const { status, espnStatus, fallback, ...kickoffFields } = options;

  if (status === 'upcoming') {
    const kickoff = formatGameKickoffTime(kickoffFields);
    if (kickoff !== 'TBD') return kickoff;
    return fallback ?? espnStatus;
  }

  return espnStatus;
}

/** Schedule card kickoff — prefers ESPN status display fields, then legacy time string. */
export function formatScheduleGameKickoff(game: EspnKickoffDisplaySource & { time?: string }): string {
  return formatGameKickoffTime(game);
}

/** @deprecated Use formatGameKickoffTime */
export const formatKickoffTime = formatGameKickoffTime;
