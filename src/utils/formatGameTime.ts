import type { GameStatus } from '@/types';

/** ESPN kickoff times are displayed in Eastern Time. */
const ESPN_KICKOFF_TIMEZONE = 'America/New_York';

/** Device timezone from Intl — used by dev diagnostics only. */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'unknown';
  }
}

function isIsoDateTimeString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value.trim());
}

function normalizeUtcIso(value: string): string {
  const shortZ = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})Z$/i.exec(value);
  if (shortZ) return `${shortZ[1]}:00.000Z`;
  return value;
}

function parseClockTime12(text: string): { hour12: number; minute: number; period: 'AM' | 'PM' } | null {
  const match = /(\d{1,2}):(\d{2})[\s\u202f]*([AaPp][Mm])\b/.exec(text);
  if (!match) return null;

  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase() as 'AM' | 'PM';

  if (!Number.isFinite(hour12) || hour12 < 1 || hour12 > 12) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;

  return { hour12, minute, period };
}

/** Render a 12-hour clock without converting through 24-hour (preserves noon/midnight). */
function formatClock12Display(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const minutePart = minute.toString().padStart(2, '0');
  return `${hour12}:${minutePart} ${period}`;
}

function formatClock12From24(hour: number, minute: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const period: 'AM' | 'PM' = normalized < 12 ? 'AM' : 'PM';
  const hour12 = normalized % 12 || 12;
  return formatClock12Display(hour12, minute, period);
}

/** Manual fallback when Intl is unavailable (Hermes-safe). */
function formatLocalTimeManual(date: Date): string {
  return formatClock12From24(date.getHours(), date.getMinutes());
}

/** Parse ESPN kickoff ISO into a Date, or null when invalid/TBD. */
export function parseGameStartTime(startTime: string | undefined): Date | null {
  if (!startTime?.trim() || startTime.trim() === 'TBD') return null;

  try {
    const trimmed = startTime.trim();
    const normalized =
      /Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)
        ? normalizeUtcIso(trimmed)
        : trimmed;
    const ms = Date.parse(normalized);
    if (Number.isNaN(ms)) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

function formatEasternTime(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ESPN_KICKOFF_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const hour = parts.find((part) => part.type === 'hour')?.value;
    const minute = parts.find((part) => part.type === 'minute')?.value;
    const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value?.toUpperCase();

    if (hour && minute && (dayPeriod === 'AM' || dayPeriod === 'PM')) {
      return formatClock12Display(Number(hour), Number(minute), dayPeriod);
    }

    return new Intl.DateTimeFormat('en-US', {
      timeZone: ESPN_KICKOFF_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return formatLocalTimeManual(date);
  }
}

/**
 * Compact kickoff time in Eastern Time, e.g. "7:00 PM ET".
 * All kickoff times are shown in ESPN Eastern Time.
 */
export function formatGameKickoffTime(startTime: string | undefined): string {
  try {
    if (!startTime?.trim() || startTime.trim() === 'TBD') return 'TBD';

    const trimmed = startTime.trim();

    if (/\bET\b/i.test(trimmed) && !isIsoDateTimeString(trimmed)) {
      return trimmed;
    }

    const clockOnly = parseClockTime12(trimmed);
    if (clockOnly && !isIsoDateTimeString(trimmed)) {
      return `${formatClock12Display(clockOnly.hour12, clockOnly.minute, clockOnly.period)} ET`;
    }

    const instant = parseGameStartTime(startTime);
    if (!instant || Number.isNaN(instant.getTime())) {
      console.warn('[formatGameKickoffTime] invalid startTime:', startTime);
      return 'TBD';
    }

    return `${formatEasternTime(instant)} ET`;
  } catch (error) {
    console.warn('[formatGameKickoffTime] failed:', startTime, error);
    return 'TBD';
  }
}

/** Compact Eastern game date for schedule rows, e.g. "Sat, Sep 6". */
export function formatGameKickoffDate(startTime: string | undefined): string {
  try {
    const date = parseGameStartTime(startTime);
    if (!date) return 'TBD';

    return new Intl.DateTimeFormat('en-US', {
      timeZone: ESPN_KICKOFF_TIMEZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return 'TBD';
  }
}

/** Eastern date + time for cards, e.g. "Thu, Sep 5 • 7:00 PM ET". */
export function formatGameKickoffDateTime(startTime: string | undefined): string {
  try {
    const date = parseGameStartTime(startTime);
    if (!date) return 'TBD';

    try {
      const datePart = new Intl.DateTimeFormat('en-US', {
        timeZone: ESPN_KICKOFF_TIMEZONE,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(date);
      const timePart = formatGameKickoffTime(startTime);
      return `${datePart} • ${timePart}`;
    } catch {
      return formatGameKickoffTime(startTime);
    }
  } catch {
    return 'TBD';
  }
}

/** Detailed Eastern kickoff with timezone label, e.g. "Thu, Sep 5 • 7:00 PM ET". */
export function formatGameKickoffDateTimeDetailed(startTime: string | undefined): string {
  return formatGameKickoffDateTime(startTime);
}

/** YYYY-MM-DD in the Eastern calendar for grouping schedule days. */
export function extractLocalGameDateIso(startTime: string): string {
  try {
    if (!startTime?.trim() || startTime.trim() === 'TBD') return 'unknown';

    const date = parseGameStartTime(startTime);
    if (!date || Number.isNaN(date.getTime())) return 'unknown';

    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: ESPN_KICKOFF_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '00';
      return `${get('year')}-${get('month')}-${get('day')}`;
    } catch {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.warn('[extractLocalGameDateIso] failed:', startTime, error);
    return 'unknown';
  }
}

/** Section header label for a schedule date key (YYYY-MM-DD). */
export function formatGameDateLabel(isoDate: string): string {
  if (isoDate === 'unknown') return 'Date TBD';

  const parsed = Date.parse(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed)) return isoDate;

  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(parsed));
  } catch {
    return isoDate;
  }
}

/** Right-rail / header status: Eastern kickoff when upcoming, ESPN status otherwise. */
export function formatGameStatusDetail(options: {
  startTime?: string;
  status: GameStatus;
  espnStatus: string;
  fallback?: string;
}): string {
  const { startTime, status, espnStatus, fallback } = options;

  if (status === 'upcoming') {
    const kickoff = formatGameKickoffTime(startTime);
    if (kickoff !== 'TBD') return kickoff;
    return fallback ?? espnStatus;
  }

  return espnStatus;
}

/** Schedule card kickoff — prefers ISO startTime, falls back to legacy time string. */
export function formatScheduleGameKickoff(game: {
  startTime?: string;
  time?: string;
}): string {
  if (game.startTime) {
    const formatted = formatGameKickoffTime(game.startTime);
    if (formatted !== 'TBD') return formatted;
  }

  const legacy = game.time?.trim();
  if (!legacy) return 'TBD';

  return formatGameKickoffTime(legacy);
}

/** @deprecated Use formatGameKickoffTime */
export const formatKickoffTime = formatGameKickoffTime;
