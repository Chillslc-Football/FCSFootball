import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  filterEspnGamesByConference,
  resolveConferenceFetchLeague,
} from '@/data/conferences/filterGamesByConference';
import { espnScoresProvider } from '@/data/providers/espnProvider';
import { mergeScoresTabRankings } from '@/data/providers/rankingMerge';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import type { ConferenceId } from '@/data/conferences/conferenceList';
import type { EspnNormalizedGame, ScheduleWeekId } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

export function useConferenceWeekSchedule(conferenceId: ConferenceId, weekId: ScheduleWeekId) {
  const fetchLeague = useMemo(
    () => resolveConferenceFetchLeague(conferenceId),
    [conferenceId],
  );

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadWeekGames = useCallback(
    async (options?: { pullRefresh?: boolean }) => {
      const pullRefresh = options?.pullRefresh ?? false;

      if (!pullRefresh) {
        setLoadState('loading');
        setErrorMessage(null);
        setGames([]);
      }

      try {
        const response = await espnScoresProvider.getWeekGames(weekId, {
          league: fetchLeague,
          forceRefresh: pullRefresh,
        });

        const merged = await mergeScoresTabRankings(response.data.games, fetchLeague);
        setGames(merged.games);
        registerEspnGames(merged.games);
        setLoadState('success');
        setErrorMessage(null);
      } catch (err) {
        if (pullRefresh) {
          console.warn('[useConferenceWeekSchedule] pull refresh failed:', err);
          return;
        }

        setGames([]);
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load schedule from ESPN.',
        );
        setLoadState('error');
      }
    },
    [weekId, fetchLeague],
  );

  useEffect(() => {
    void loadWeekGames();
  }, [loadWeekGames]);

  const refresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);
    try {
      await loadWeekGames({ pullRefresh: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadWeekGames, refreshing]);

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
  };
}
