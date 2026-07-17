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

  const loadWeekGames = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage(null);
    setGames([]);

    try {
      const response = await espnScoresProvider.getWeekGames(weekId, {
        league: fetchLeague,
      });

      const merged = await mergeScoresTabRankings(response.data.games, fetchLeague);
      setGames(merged.games);
      registerEspnGames(merged.games);
      setLoadState('success');
    } catch (err) {
      setGames([]);
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not load schedule from ESPN.',
      );
      setLoadState('error');
    }
  }, [weekId, fetchLeague]);

  useEffect(() => {
    void loadWeekGames();
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
  };
}
