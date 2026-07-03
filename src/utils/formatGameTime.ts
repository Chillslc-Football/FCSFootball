import type { GameStatus } from '@/types';

/** Device timezone from Intl — no hardcoded region. */
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

/** Manual local time when Intl is unavailable (Hermes-safe). */
function formatLocalTimeManual(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minutePart = minutes.toString().padStart(2, '0');
  return `${hour12}:${minutePart} ${period}`;
}

/** Parse ESPN ISO kickoff string into a Date, or null when invalid/TBD. */
export function parseGameStartTime(startTime: string | undefined): Date | null {
  if (!startTime || startTime === 'TBD') return null;
  const parsed = Date.parse(startTime);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

/** Compact kickoff time in the device local timezone, e.g. "2:00 PM". */
export function formatGameKickoffTime(startTime: string | undefined): string {
  const date = parseGameStartTime(startTime);
  if (!date) return 'TBD';

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return formatLocalTimeManual(date);
  }
}

/** Local date + time for cards, e.g. "Thu, Sep 5 • 6:30 PM". */
export function formatGameKickoffDateTime(startTime: string | undefined): string {
  const date = parseGameStartTime(startTime);
  if (!date) return 'TBD';

  try {
    const datePart = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
    const timePart = formatGameKickoffTime(startTime);
    return `${datePart} • ${timePart}`;
  } catch {
    const timePart = formatLocalTimeManual(date);
    return timePart;
  }
}

/** Detailed local kickoff with timezone abbreviation, e.g. "Thu, Sep 5 • 6:30 PM MDT". */
export function formatGameKickoffDateTimeDetailed(startTime: string | undefined): string {
  const date = parseGameStartTime(startTime);
  if (!date) return 'TBD';

  try {
    const datePart = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
    const timePart = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
    return `${datePart} • ${timePart}`;
  } catch {
    return 'TBD';
  }
}

/** YYYY-MM-DD in the device local calendar for grouping schedule days. */
export function extractLocalGameDateIso(startTime: string): string {
  const date = parseGameStartTime(startTime);
  if (!date) return 'unknown';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Section header label for a local schedule date key (YYYY-MM-DD). */
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

/** Right-rail / header status: local kickoff when upcoming, ESPN status otherwise. */
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
  if (isIsoDateTimeString(legacy)) {
    const formatted = formatGameKickoffTime(legacy);
    if (formatted !== 'TBD') return formatted;
  }

  return legacy;
}

/** @deprecated Use formatGameKickoffTime */
export const formatKickoffTime = formatGameKickoffTime;
