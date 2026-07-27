import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  filterEspnGamesByConference,
  resolveConferenceFetchLeague,
} from '@/data/conferences/filterGamesByConference';
import { espnScoresProvider } from '@/data/providers/espnProvider';
import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import { mergeScoresTabRankings } from '@/data/providers/rankingMerge';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import type { ConferenceId } from '@/data/conferences/conferenceList';
import type { EspnNormalizedGame, ScheduleWeekId } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

type LoadOptions = {
  pullRefresh?: boolean;
  forceRefresh?: boolean;
  silent?: boolean;
  trigger?: string;
};

export function useConferenceWeekSchedule(conferenceId: ConferenceId, weekId: ScheduleWeekId) {
  const fetchLeague = useMemo(
    () => resolveConferenceFetchLeague(conferenceId),
    [conferenceId],
  );

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const gamesCountRef = useRef(0);
  gamesCountRef.current = games.length;

  const loadWeekGames = useCallback(
    async (options?: LoadOptions) => {
      if (inFlightRef.current && !options?.pullRefresh) {
        return inFlightRef.current;
      }

      const pullRefresh = options?.pullRefresh ?? false;
      const silent = options?.silent ?? false;
      const forceRefresh = options?.forceRefresh ?? pullRefresh;
      const trigger =
        options?.trigger ?? (pullRefresh ? 'conference-schedule-ptr' : 'conference-schedule-mount');

      const run = (async () => {
        if (!silent && !pullRefresh && gamesCountRef.current === 0) {
          setLoadState('loading');
          setErrorMessage(null);
        }

        logEspnRefreshDev({
          source: 'ESPN',
          screen: 'Conference',
          trigger,
          phase: 'start',
          note: `${conferenceId}/${weekId}/${fetchLeague} force=${forceRefresh}`,
        });

        try {
          const response = await espnScoresProvider.getWeekGames(weekId, {
            league: fetchLeague,
            forceRefresh,
          });

          const merged = await mergeScoresTabRankings(response.data.games, fetchLeague);
          setGames(merged.games);
          registerEspnGames(merged.games);
          setLoadState('success');
          setErrorMessage(null);
          logEspnRefreshDev({
            source: 'ESPN',
            screen: 'Conference',
            trigger,
            phase: 'success',
            count: merged.games.length,
          });
        } catch (err) {
          logEspnRefreshDev({
            source: 'ESPN',
            screen: 'Conference',
            trigger,
            phase: 'error',
            error: err,
          });

          if (silent || pullRefresh || gamesCountRef.current > 0) {
            console.warn('[useConferenceWeekSchedule] refresh failed; keeping previous games:', err);
            if (!silent && !pullRefresh) setLoadState('success');
            return;
          }

          setGames([]);
          setErrorMessage(
            err instanceof Error ? err.message : 'Could not load schedule from ESPN.',
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
    [weekId, fetchLeague, conferenceId],
  );

  useEffect(() => {
    void loadWeekGames({ trigger: 'conference-schedule-params' });
  }, [loadWeekGames]);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadWeekGames({ pullRefresh: true, forceRefresh: true, trigger: 'conference-schedule-ptr' });
    } finally {
      setRefreshing(false);
    }
  }, [loadWeekGames, refreshing]);

  const refreshSilent = useCallback(async () => {
    await loadWeekGames({
      forceRefresh: true,
      silent: true,
      trigger: 'conference-schedule-focus',
    });
  }, [loadWeekGames]);

  const filteredGames = useMemo(
    () => filterEspnGamesByConference(games, conferenceId),
    [games, conferenceId],
  );

  return {
    loadState,
    games,
    filteredGames,
    errorMessage,
    fetchLeague,
    refreshing,
    refresh,
    refreshSilent,
    /** Shared loader for focus / live polling / pull-to-refresh. */
    loadWeekGames,
  };
}
