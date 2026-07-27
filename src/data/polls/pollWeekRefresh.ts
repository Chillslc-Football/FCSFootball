import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildRankingsFingerprint } from '@/data/providers/ncaaRankingsParser';
import type { NcaaRankingsPayload } from '@/types';

/** Poll expectation boundary: Tuesday 6:00 AM America/Denver. */
export const POLL_WEEK_TIME_ZONE = 'America/Denver';
export const POLL_WEEK_RESET_WEEKDAY = 2; // Tuesday (Sun=0)
export const POLL_WEEK_RESET_HOUR = 6;
export const POLL_AUTO_RETRY_INTERVAL_MS = 60 * 60 * 1000;

const REFRESH_META_KEY = 'fcsfootball.pollRefresh.meta.v2';
const PAYLOAD_CACHE_KEY = 'fcsfootball.pollRefresh.payload.v1';
/** Legacy v1 meta — read once for migration. */
const LEGACY_REFRESH_META_KEY = 'fcsfootball.pollRefresh.meta.v1';

export type PollRefreshMeta = {
  /** ISO timestamp of last successful live/static poll save. */
  lastSuccessAt: string;
  /** ISO timestamp of last automatic check attempt (focus/app-open). */
  lastAutoCheckAt?: string;
  /**
   * Denver calendar date (YYYY-MM-DD) of the Tuesday 6:00 AM boundary
   * for which a new poll has already been detected and saved.
   */
  satisfiedCycleId?: string;
  /** Source poll week when last saved. */
  sourcePollWeek?: number;
  /** Source release id when last saved. */
  sourceReleaseId?: string;
  /** Official publication/update date from source when last saved (ISO). */
  officialPublishedAt?: string;
  /** Rankings content fingerprint when last saved. */
  rankingsFingerprint?: string;
};

type DenverParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun … 6=Sat
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function shiftYmd(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/** Read calendar / clock parts in America/Denver. */
export function getDenverParts(date: Date = new Date()): DenverParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: POLL_WEEK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_TO_INDEX[parts.weekday ?? ''] ?? 0,
  };
}

/**
 * Expected poll cycle id = Denver YYYY-MM-DD of the Tuesday 6:00 AM boundary
 * that is currently in effect.
 */
export function getCurrentPollWeekId(now: Date = new Date()): string {
  const denver = getDenverParts(now);
  let daysSinceTuesday = (denver.weekday - POLL_WEEK_RESET_WEEKDAY + 7) % 7;

  // Before Tuesday 6:00 AM Denver, still the previous poll cycle.
  if (daysSinceTuesday === 0 && denver.hour < POLL_WEEK_RESET_HOUR) {
    daysSinceTuesday = 7;
  }

  const tuesday = shiftYmd(denver.year, denver.month, denver.day, -daysSinceTuesday);
  return `${tuesday.year}-${pad2(tuesday.month)}-${pad2(tuesday.day)}`;
}

function normalizeOfficialDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    // Accept bare YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return null;
  }
  return parsed.toISOString();
}

function officialDateKey(value: string | undefined | null): string | null {
  const normalized = normalizeOfficialDate(value);
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return normalized.slice(0, 10);
}

function fingerprintOf(payload: NcaaRankingsPayload): string {
  return payload.rankingsFingerprint ?? buildRankingsFingerprint(payload.teams);
}

/**
 * New-poll detection priority:
 * 1) source poll week / release id
 * 2) official publication / update date
 * 3) rankings content comparison
 *
 * A successful request alone is never enough to mark a poll as new.
 */
export function isIncomingPollNew(
  incoming: NcaaRankingsPayload,
  previous: NcaaRankingsPayload | null,
): boolean {
  if (!previous?.teams?.length) return true;

  if (
    incoming.week != null &&
    previous.week != null &&
    Number.isFinite(incoming.week) &&
    Number.isFinite(previous.week) &&
    incoming.week !== previous.week
  ) {
    return true;
  }

  if (
    incoming.releaseId &&
    previous.releaseId &&
    incoming.releaseId !== previous.releaseId
  ) {
    return true;
  }

  const incomingDate = officialDateKey(incoming.officialPublishedAt ?? incoming.updatedAt);
  const previousDate = officialDateKey(previous.officialPublishedAt ?? previous.updatedAt);
  if (incomingDate && previousDate && incomingDate !== previousDate) {
    return true;
  }

  return fingerprintOf(incoming) !== fingerprintOf(previous);
}

export async function loadPollRefreshMeta(): Promise<PollRefreshMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(REFRESH_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PollRefreshMeta>;
      if (typeof parsed.lastSuccessAt === 'string' && parsed.lastSuccessAt) {
        return {
          lastSuccessAt: parsed.lastSuccessAt,
          lastAutoCheckAt:
            typeof parsed.lastAutoCheckAt === 'string' ? parsed.lastAutoCheckAt : undefined,
          satisfiedCycleId:
            typeof parsed.satisfiedCycleId === 'string' ? parsed.satisfiedCycleId : undefined,
          sourcePollWeek:
            typeof parsed.sourcePollWeek === 'number' ? parsed.sourcePollWeek : undefined,
          sourceReleaseId:
            typeof parsed.sourceReleaseId === 'string' ? parsed.sourceReleaseId : undefined,
          officialPublishedAt:
            typeof parsed.officialPublishedAt === 'string'
              ? parsed.officialPublishedAt
              : undefined,
          rankingsFingerprint:
            typeof parsed.rankingsFingerprint === 'string'
              ? parsed.rankingsFingerprint
              : undefined,
        };
      }
    }

    // Migrate legacy v1 meta (Wednesday-based pollWeekId → no satisfied cycle).
    const legacyRaw = await AsyncStorage.getItem(LEGACY_REFRESH_META_KEY);
    if (!legacyRaw) return null;
    const legacy = JSON.parse(legacyRaw) as { lastSuccessAt?: string; pollWeekId?: string };
    if (typeof legacy.lastSuccessAt !== 'string' || !legacy.lastSuccessAt) return null;
    const migrated: PollRefreshMeta = {
      lastSuccessAt: legacy.lastSuccessAt,
      // Do not treat legacy Wednesday ids as satisfied Tuesday cycles.
      satisfiedCycleId: undefined,
    };
    await savePollRefreshMeta(migrated);
    return migrated;
  } catch {
    return null;
  }
}

export async function savePollRefreshMeta(meta: PollRefreshMeta): Promise<void> {
  try {
    await AsyncStorage.setItem(REFRESH_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.warn('[pollWeekRefresh] failed to save meta:', error);
  }
}

export async function loadCachedPollPayload(): Promise<NcaaRankingsPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(PAYLOAD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NcaaRankingsPayload;
    if (!parsed || !Array.isArray(parsed.teams)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedPollPayload(payload: NcaaRankingsPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(PAYLOAD_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[pollWeekRefresh] failed to save payload:', error);
  }
}

export type PollFetchDecisionReason =
  | 'manual'
  | 'no-saved-poll'
  | 'awaiting-new-poll'
  | 'hourly-retry-blocked'
  | 'already-have-current-poll';

export type PollFetchDecision = {
  needed: boolean;
  reason: PollFetchDecisionReason;
  /** Denver Tuesday cycle id currently in effect. */
  pollWeekId: string;
  hourlyRetryBlocked: boolean;
};

function isHourlyRetryBlocked(meta: PollRefreshMeta, now: Date): boolean {
  if (!meta.lastAutoCheckAt) return false;
  const last = Date.parse(meta.lastAutoCheckAt);
  if (Number.isNaN(last)) return false;
  return now.getTime() - last < POLL_AUTO_RETRY_INTERVAL_MS;
}

/**
 * Decide whether an automatic or forced poll live request is required.
 *
 * Tuesday 6:00 AM America/Denver opens a new expected cycle id. Automatic
 * fetches continue (at most hourly on open/focus) until a new poll is detected
 * for that cycle, then pause until the following Tuesday boundary.
 */
export async function decidePollFetch(options?: {
  force?: boolean;
  now?: Date;
  hasSavedPoll?: boolean;
}): Promise<PollFetchDecision> {
  const now = options?.now ?? new Date();
  const pollWeekId = getCurrentPollWeekId(now);

  if (options?.force) {
    return {
      needed: true,
      reason: 'manual',
      pollWeekId,
      hourlyRetryBlocked: false,
    };
  }

  const cached =
    options?.hasSavedPoll === true
      ? true
      : options?.hasSavedPoll === false
        ? false
        : Boolean(await loadCachedPollPayload());

  if (!cached) {
    return {
      needed: true,
      reason: 'no-saved-poll',
      pollWeekId,
      hourlyRetryBlocked: false,
    };
  }

  const meta = await loadPollRefreshMeta();

  if (meta?.satisfiedCycleId === pollWeekId) {
    return {
      needed: false,
      reason: 'already-have-current-poll',
      pollWeekId,
      hourlyRetryBlocked: false,
    };
  }

  if (meta && isHourlyRetryBlocked(meta, now)) {
    return {
      needed: false,
      reason: 'hourly-retry-blocked',
      pollWeekId,
      hourlyRetryBlocked: true,
    };
  }

  return {
    needed: true,
    reason: 'awaiting-new-poll',
    pollWeekId,
    hourlyRetryBlocked: false,
  };
}

export async function recordAutomaticPollCheckAttempt(
  now: Date = new Date(),
): Promise<PollRefreshMeta> {
  const existing = (await loadPollRefreshMeta()) ?? {
    lastSuccessAt: now.toISOString(),
  };
  const next: PollRefreshMeta = {
    ...existing,
    lastAutoCheckAt: now.toISOString(),
  };
  await savePollRefreshMeta(next);
  return next;
}

export async function recordSuccessfulPollCheck(options: {
  payload: NcaaRankingsPayload;
  previous: NcaaRankingsPayload | null;
  cycleId: string;
  isAutomatic: boolean;
  /** When false (static bootstrap), never mark the Tuesday cycle satisfied. */
  satisfyCycleOnNew?: boolean;
  now?: Date;
}): Promise<{ meta: PollRefreshMeta; isNew: boolean }> {
  const now = options.now ?? new Date();
  const isNew = isIncomingPollNew(options.payload, options.previous);
  const existing = await loadPollRefreshMeta();
  const satisfyCycleOnNew = options.satisfyCycleOnNew !== false;

  const meta: PollRefreshMeta = {
    lastSuccessAt: now.toISOString(),
    lastAutoCheckAt: options.isAutomatic
      ? now.toISOString()
      : existing?.lastAutoCheckAt,
    satisfiedCycleId:
      isNew && satisfyCycleOnNew
        ? options.cycleId
        : existing?.satisfiedCycleId,
    sourcePollWeek: isNew
      ? options.payload.week
      : existing?.sourcePollWeek ?? options.previous?.week,
    sourceReleaseId: isNew
      ? options.payload.releaseId
      : existing?.sourceReleaseId ?? options.previous?.releaseId,
    officialPublishedAt: isNew
      ? options.payload.officialPublishedAt ?? options.payload.updatedAt
      : existing?.officialPublishedAt ??
        options.previous?.officialPublishedAt ??
        options.previous?.updatedAt,
    rankingsFingerprint: isNew
      ? fingerprintOf(options.payload)
      : existing?.rankingsFingerprint ??
        (options.previous ? fingerprintOf(options.previous) : undefined),
  };

  if (isNew) {
    await Promise.all([savePollRefreshMeta(meta), saveCachedPollPayload(options.payload)]);
  } else {
    // Retain rankings/metadata; still persist check timestamps.
    await savePollRefreshMeta(meta);
  }

  return { meta, isNew };
}

/** Save bundled static rankings without marking the weekly cycle complete. */
export async function saveBootstrapPollPayload(
  payload: NcaaRankingsPayload,
  now: Date = new Date(),
): Promise<PollRefreshMeta> {
  const meta: PollRefreshMeta = {
    lastSuccessAt: now.toISOString(),
    sourcePollWeek: payload.week,
    sourceReleaseId: payload.releaseId,
    officialPublishedAt: payload.officialPublishedAt ?? payload.updatedAt,
    rankingsFingerprint: fingerprintOf(payload),
  };
  await Promise.all([savePollRefreshMeta(meta), saveCachedPollPayload(payload)]);
  return meta;
}

export function formatPollDisplayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const utc = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));
      return utc.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function buildPollMetadataLines(
  payload: NcaaRankingsPayload | null,
  meta: PollRefreshMeta | null,
): { pollName: string; weekLabel: string | null; dateLabel: string | null } {
  const pollName = payload?.pollName?.trim() || 'Stats Perform FCS Top 25';
  const week = payload?.week ?? meta?.sourcePollWeek;
  const weekLabel =
    typeof week === 'number' && Number.isFinite(week) ? `Week ${week}` : null;

  // Prefer official source publication/update date. Never label local fetch as "Updated".
  const official =
    payload?.officialPublishedAt ??
    meta?.officialPublishedAt ??
    payload?.updatedAt;

  if (official) {
    return {
      pollName,
      weekLabel,
      dateLabel: `Updated ${formatPollDisplayDate(official)}`,
    };
  }

  if (meta?.lastSuccessAt) {
    return {
      pollName,
      weekLabel,
      dateLabel: `Checked ${formatPollDisplayDate(meta.lastSuccessAt)}`,
    };
  }

  return { pollName, weekLabel, dateLabel: null };
}
