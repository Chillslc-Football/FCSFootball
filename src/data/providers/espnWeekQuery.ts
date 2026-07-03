import { ESPN_FETCH_TIMEOUT_MS, EspnFetchError } from '@/data/providers/espnFetch';
import type { FetchWithTimeoutOptions } from '@/data/providers/espnFetch';

/** College football scoreboard — week navigation base (no groups filter). */
export const ESPN_SCOREBOARD_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';

/** FCS/I-AA default — groups=81 only. */
export const ESPN_FCS_SCOREBOARD_URL = `${ESPN_SCOREBOARD_BASE}?groups=81`;

export type EspnWeekPresetId = 'opening-slate' | 'week-0' | 'week-1' | 'week-2';

export type EspnWeekQueryPreset = {
  id: EspnWeekPresetId;
  label: string;
  selectedWeekLabel: string;
  queryDescription: string;
  buildUrl: () => string;
};

/** Dev-test week presets mapped to ESPN query strings. */
export const ESPN_WEEK_QUERY_PRESETS: Record<EspnWeekPresetId, EspnWeekQueryPreset> = {
  'opening-slate': {
    id: 'opening-slate',
    label: 'Raw opening slate',
    selectedWeekLabel: 'Opening slate',
    queryDescription: 'groups=81',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81`,
  },
  'week-0': {
    id: 'week-0',
    label: 'Week 0',
    selectedWeekLabel: 'Week 0',
    queryDescription: 'groups=81&seasontype=2&week=0',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=2&week=0`,
  },
  'week-1': {
    id: 'week-1',
    label: 'Week 1',
    selectedWeekLabel: 'Week 1',
    queryDescription: 'groups=81&seasontype=2&week=1',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=2&week=1`,
  },
  'week-2': {
    id: 'week-2',
    label: 'Week 2',
    selectedWeekLabel: 'Week 2',
    queryDescription: 'groups=81&seasontype=2&week=2',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=2&week=2`,
  },
};

/** All query format variants to compare on the dev test screen. */
export const ESPN_WEEK_FORMAT_VARIANTS: { label: string; buildUrl: () => string }[] = [
  {
    label: 'groups=81',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81`,
  },
  {
    label: 'groups=81&week=0',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81&week=0`,
  },
  {
    label: 'groups=81&week=1',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81&week=1`,
  },
  {
    label: 'groups=81&seasontype=2&week=0',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=2&week=0`,
  },
  {
    label: 'groups=81&seasontype=2&week=1',
    buildUrl: () => `${ESPN_SCOREBOARD_BASE}?groups=81&seasontype=2&week=1`,
  },
];

export type EspnFormatCompareResult = {
  label: string;
  url: string;
  httpStatus: number | null;
  eventsLength: number;
  error?: string;
};

function countEvents(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 0;
  const events = (raw as Record<string, unknown>).events;
  return Array.isArray(events) ? events.length : 0;
}

/** Fetch each week query variant and return events.length for side-by-side comparison. */
export async function compareEspnWeekQueryFormats(
  { signal, timeoutMs = ESPN_FETCH_TIMEOUT_MS }: FetchWithTimeoutOptions = {},
): Promise<EspnFormatCompareResult[]> {
  if (signal?.aborted) {
    throw new EspnFetchError('Request was cancelled.');
  }

  const probeOne = async (
    label: string,
    url: string,
  ): Promise<EspnFormatCompareResult> => {
    if (signal?.aborted) {
      return { label, url, httpStatus: null, eventsLength: 0, error: 'Cancelled' };
    }

    const timeoutController = new AbortController();
    const onAbort = () => timeoutController.abort();
    signal?.addEventListener('abort', onAbort);

    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: timeoutController.signal,
      });

      let eventsLength = 0;
      if (response.ok) {
        try {
          const raw = (await response.json()) as unknown;
          eventsLength = countEvents(raw);
        } catch {
          return {
            label,
            url,
            httpStatus: response.status,
            eventsLength: 0,
            error: 'Invalid JSON',
          };
        }
      }

      return {
        label,
        url,
        httpStatus: response.status,
        eventsLength,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { label, url, httpStatus: null, eventsLength: 0, error: message };
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    }
  };

  return Promise.all(
    ESPN_WEEK_FORMAT_VARIANTS.map(({ label, buildUrl }) => {
      const url = buildUrl();
      return probeOne(label, url);
    }),
  );
}

export function buildEspnWeekScoreboardUrl(presetId: EspnWeekPresetId): string {
  return ESPN_WEEK_QUERY_PRESETS[presetId].buildUrl();
}
