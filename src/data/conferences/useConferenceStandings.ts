import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchConferenceStandings } from '@/data/providers/espnStandingsProvider';
import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import type { ConferenceId } from '@/data/conferences/conferenceList';
import type { ConferenceStandingEntry } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

type StandingsCacheEntry = {
  entries: ConferenceStandingEntry[];
  conferenceName?: string;
  unavailable: boolean;
};

type LoadOptions = {
  pullRefresh?: boolean;
  forceRefresh?: boolean;
  silent?: boolean;
  trigger?: string;
};

const standingsCache = new Map<ConferenceId, StandingsCacheEntry>();

export function clearConferenceStandingsCache(conferenceId?: ConferenceId): void {
  if (conferenceId) {
    standingsCache.delete(conferenceId);
    return;
  }
  standingsCache.clear();
}

export function useConferenceStandings(conferenceId: ConferenceId) {
  const cached = standingsCache.get(conferenceId);
  const [loadState, setLoadState] = useState<LoadState>(cached ? 'success' : 'loading');
  const [entries, setEntries] = useState<ConferenceStandingEntry[]>(cached?.entries ?? []);
  const [conferenceName, setConferenceName] = useState<string | undefined>(cached?.conferenceName);
  const [unavailable, setUnavailable] = useState(cached?.unavailable ?? false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const entriesCountRef = useRef(0);
  entriesCountRef.current = entries.length;

  const loadStandings = useCallback(
    async (options?: LoadOptions) => {
      if (inFlightRef.current && !options?.pullRefresh) {
        return inFlightRef.current;
      }

      const pullRefresh = options?.pullRefresh ?? false;
      const silent = options?.silent ?? false;
      const forceRefresh = options?.forceRefresh ?? pullRefresh;
      const trigger =
        options?.trigger ?? (pullRefresh ? 'conference-standings-ptr' : 'conference-standings-mount');

      const run = (async () => {
        if (!forceRefresh) {
          const existing = standingsCache.get(conferenceId);
          if (existing) {
            setEntries(existing.entries);
            setConferenceName(existing.conferenceName);
            setUnavailable(existing.unavailable);
            setLoadState('success');
            setErrorMessage(null);
            logEspnRefreshDev({
              source: 'ESPN',
              screen: 'Conference',
              trigger,
              phase: 'skip',
              count: existing.entries.length,
              note: 'memory cache hit',
            });
            return;
          }
        }

        if (!silent && !pullRefresh && entriesCountRef.current === 0) {
          setLoadState('loading');
          setErrorMessage(null);
        }

        logEspnRefreshDev({
          source: 'ESPN',
          screen: 'Conference',
          trigger,
          phase: 'start',
          note: `${conferenceId} standings force=${forceRefresh}`,
        });

        try {
          const response = await fetchConferenceStandings(conferenceId, {
            forceRefresh,
          });

          const payload = response.data;
          const cacheEntry: StandingsCacheEntry = {
            entries: payload.entries,
            conferenceName: payload.conferenceName,
            unavailable: Boolean(payload.unavailable),
          };

          standingsCache.set(conferenceId, cacheEntry);
          setEntries(cacheEntry.entries);
          setConferenceName(cacheEntry.conferenceName);
          setUnavailable(cacheEntry.unavailable);
          setLoadState('success');
          setErrorMessage(null);
          logEspnRefreshDev({
            source: 'ESPN',
            screen: 'Conference',
            trigger,
            phase: 'success',
            count: cacheEntry.entries.length,
          });
        } catch (err) {
          logEspnRefreshDev({
            source: 'ESPN',
            screen: 'Conference',
            trigger,
            phase: 'error',
            error: err,
          });

          if (silent || pullRefresh || entriesCountRef.current > 0) {
            console.warn('[useConferenceStandings] refresh failed; keeping previous standings:', err);
            if (!silent && !pullRefresh) setLoadState('success');
            return;
          }

          setEntries([]);
          setUnavailable(false);
          setErrorMessage(
            err instanceof Error ? err.message : 'Could not load conference standings from ESPN.',
          );
          setLoadState('error');
        }
      })();

      inFlightRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightRef.current === run) inFlightRef.current = null;
      }
    },
    [conferenceId],
  );

  useEffect(() => {
    void loadStandings({ trigger: 'conference-standings-params' });
  }, [loadStandings]);

  const refresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);
    clearConferenceStandingsCache(conferenceId);

    try {
      await loadStandings({
        pullRefresh: true,
        forceRefresh: true,
        trigger: 'conference-standings-ptr',
      });
    } finally {
      setRefreshing(false);
    }
  }, [conferenceId, loadStandings, refreshing]);

  const refreshSilent = useCallback(async () => {
    await loadStandings({
      forceRefresh: true,
      silent: true,
      trigger: 'conference-standings-focus',
    });
  }, [loadStandings]);

  return useMemo(
    () => ({
      loadState,
      entries,
      conferenceName,
      unavailable,
      errorMessage,
      refreshing,
      refresh,
      refreshSilent,
    }),
    [
      loadState,
      entries,
      conferenceName,
      unavailable,
      errorMessage,
      refreshing,
      refresh,
      refreshSilent,
    ],
  );
}
