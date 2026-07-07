import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  hasLiveEspnNormalizedGames,
  SCORES_LIVE_REFRESH_INTERVAL_MS,
} from '@/data/scores/scoresLiveRefresh';
import type { EspnNormalizedGame } from '@/types';

export type ScoresSilentRefreshOptions = {
  forceRefresh?: boolean;
  silent?: boolean;
};

type UseScoresLiveRefreshArgs = {
  visibleGames: EspnNormalizedGame[];
  loadGames: (options?: ScoresSilentRefreshOptions) => Promise<void>;
  enabled?: boolean;
};

function isAppActive(state: AppStateStatus): boolean {
  return state === 'active';
}

/**
 * Poll ESPN scores every 30s while the Scores tab is focused, the app is
 * foregrounded, and at least one filtered/visible game is live.
 */
export function useScoresLiveRefresh({
  visibleGames,
  loadGames,
  enabled = true,
}: UseScoresLiveRefreshArgs): void {
  const hasVisibleLiveGames = hasLiveEspnNormalizedGames(visibleGames);
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const [appIsActive, setAppIsActive] = useState(() => isAppActive(AppState.currentState));
  const appStateRef = useRef(AppState.currentState);
  const isScreenFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      setIsScreenFocused(true);

      return () => {
        isScreenFocusedRef.current = false;
        setIsScreenFocused(false);
      };
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = !isAppActive(appStateRef.current);
      appStateRef.current = nextState;
      const nextIsActive = isAppActive(nextState);
      setAppIsActive(nextIsActive);

      if (nextIsActive && wasInactive && enabled && isScreenFocusedRef.current) {
        void loadGames({ forceRefresh: true, silent: true });
      }
    });

    return () => subscription.remove();
  }, [enabled, loadGames]);

  const shouldPoll = enabled && appIsActive && isScreenFocused && hasVisibleLiveGames;

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const intervalId = setInterval(() => {
      void loadGames({ forceRefresh: true, silent: true });
    }, SCORES_LIVE_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [shouldPoll, loadGames]);
}
