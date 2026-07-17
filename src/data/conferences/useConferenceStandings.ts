import { useEffect, useMemo, useState } from 'react';

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

export function useConferenceStandings(conferenceId: ConferenceId) {
  const cached = standingsCache.get(conferenceId);
  const [loadState, setLoadState] = useState<LoadState>(cached ? 'success' : 'loading');
  const [entries, setEntries] = useState<ConferenceStandingEntry[]>(cached?.entries ?? []);
  const [conferenceName, setConferenceName] = useState<string | undefined>(cached?.conferenceName);
  const [unavailable, setUnavailable] = useState(cached?.unavailable ?? false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const existing = standingsCache.get(conferenceId);
    if (existing) {
      setEntries(existing.entries);
      setConferenceName(existing.conferenceName);
      setUnavailable(existing.unavailable);
      setLoadState('success');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    async function loadStandings() {
      setLoadState('loading');
      setErrorMessage(null);

      try {
        const response = await fetchConferenceStandings(conferenceId);
        if (cancelled) return;

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
      } catch (err) {
        if (cancelled) return;
        setEntries([]);
        setUnavailable(false);
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load conference standings from ESPN.',
        );
        setLoadState('error');
      }
    }

    void loadStandings();

    return () => {
      cancelled = true;
    };
  }, [conferenceId]);

  return useMemo(
    () => ({
      loadState,
      entries,
      conferenceName,
      unavailable,
      errorMessage,
    }),
    [loadState, entries, conferenceName, unavailable, errorMessage],
  );
}
