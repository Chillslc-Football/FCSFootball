import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchConferenceStandings } from '@/data/providers/espnStandingsProvider';
import type { ConferenceId } from '@/data/conferences/conferenceList';
import type { ConferenceStandingEntry } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

type StandingsCacheEntry = {
  entries: ConferenceStandingEntry[];
  conferenceName?: string;
  unavailable: boolean;
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

  const loadStandings = useCallback(
    async (options?: { pullRefresh?: boolean }) => {
      const pullRefresh = options?.pullRefresh ?? false;

      if (!pullRefresh) {
        const existing = standingsCache.get(conferenceId);
        if (existing) {
          setEntries(existing.entries);
          setConferenceName(existing.conferenceName);
          setUnavailable(existing.unavailable);
          setLoadState('success');
          setErrorMessage(null);
          return;
        }

        setLoadState('loading');
        setErrorMessage(null);
      }

      try {
        const response = await fetchConferenceStandings(conferenceId, {
          forceRefresh: pullRefresh,
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
      } catch (err) {
        if (pullRefresh) {
          console.warn('[useConferenceStandings] pull refresh failed:', err);
          return;
        }

        setEntries([]);
        setUnavailable(false);
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load conference standings from ESPN.',
        );
        setLoadState('error');
      }
    },
    [conferenceId],
  );

  useEffect(() => {
    void loadStandings();
  }, [loadStandings]);

  const refresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);
    clearConferenceStandingsCache(conferenceId);

    try {
      await loadStandings({ pullRefresh: true });
    } finally {
      setRefreshing(false);
    }
  }, [conferenceId, loadStandings, refreshing]);

  return useMemo(
    () => ({
      loadState,
      entries,
      conferenceName,
      unavailable,
      errorMessage,
      refreshing,
      refresh,
    }),
    [loadState, entries, conferenceName, unavailable, errorMessage, refreshing, refresh],
  );
}
