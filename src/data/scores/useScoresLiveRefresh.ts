import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import {
  countLiveEspnNormalizedGames,
  hasLiveEspnNormalizedGames,
  SCORES_LIVE_REFRESH_INTERVAL_MS,
} from '@/data/scores/scoresLiveRefresh';
import type { EspnNormalizedGame } from '@/types';

export type ScoresSilentRefreshOptions = {
  forceRefresh?: boolean;
  silent?: boolean;
  trigger?: string;
};

type UseScoresLiveRefreshArgs = {
  /** Screen label for development diagnostics (Scores, Conference, Favorites, Team). */
  screen: string;
  /** Games currently displayed on this screen — polling only while any are live. */
  visibleGames: EspnNormalizedGame[];
  /** Shared loader used by focus/app-active/interval and pull-to-refresh. */
  loadGames: (options?: ScoresSilentRefreshOptions) => Promise<void>;
  enabled?: boolean;
  /**
   * When true (default), force-refresh on focus.
   * Set false when the screen already owns focus refresh (e.g. Conference schedule/standings).
   */
  refreshOnFocus?: boolean;
  /** When true (default), force-refresh when returning to foreground while focused. */
  refreshOnAppActive?: boolean;
};

function isAppActive(state: AppStateStatus): boolean {
  return state === 'active';
}

function triggerPrefix(screen: string): string {
  return screen.trim().toLowerCase().replace(/\s+/g, '-') || 'screen';
}

/**
 * Shared live-game refresh for Scores, Conference schedule, Favorites, and Team.
 *
 * - Optional immediate ESPN force-refresh on focus / app-active
 * - Poll visible live games every 60s while focused, foregrounded, and live games exist
 * - One interval per mounted screen; overlapping ticks coalesced; cleared on blur/unmount
 * - Pull-to-refresh should call the same loadGames (no second interval)
 */
export function useScoresLiveRefresh({
  screen,
  visibleGames,
  loadGames,
  enabled = true,
  refreshOnFocus = true,
  refreshOnAppActive = true,
}: UseScoresLiveRefreshArgs): void {
  const hasVisibleLiveGames = hasLiveEspnNormalizedGames(visibleGames);
  const liveCount = countLiveEspnNormalizedGames(visibleGames);
  const prefix = triggerPrefix(screen);
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const [appIsActive, setAppIsActive] = useState(() => isAppActive(AppState.currentState));
  const appStateRef = useRef(AppState.currentState);
  const isScreenFocusedRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const wasPollingRef = useRef(false);

  const runSilentForceRefresh = useCallback(
    async (trigger: string) => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        await loadGames({ forceRefresh: true, silent: true, trigger });
      } finally {
        pollInFlightRef.current = false;
      }
    },
    [loadGames],
  );

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      setIsScreenFocused(true);

      if (enabled && refreshOnFocus) {
        void runSilentForceRefresh(`${prefix}-focus`);
      }

      return () => {
        isScreenFocusedRef.current = false;
        setIsScreenFocused(false);
        if (wasPollingRef.current) {
          logEspnRefreshDev({
            source: 'ESPN',
            screen,
            trigger: 'blur',
            phase: 'poll-stop',
            activeLiveGames: 0,
            note: `${screen} lost focus`,
          });
          wasPollingRef.current = false;
        }
      };
    }, [enabled, prefix, refreshOnFocus, runSilentForceRefresh, screen]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = !isAppActive(appStateRef.current);
      appStateRef.current = nextState;
      const nextIsActive = isAppActive(nextState);
      setAppIsActive(nextIsActive);

      if (
        nextIsActive &&
        wasInactive &&
        enabled &&
        refreshOnAppActive &&
        isScreenFocusedRef.current
      ) {
        void runSilentForceRefresh(`${prefix}-app-active`);
      }
    });

    return () => subscription.remove();
  }, [enabled, prefix, refreshOnAppActive, runSilentForceRefresh]);

  const shouldPoll = enabled && appIsActive && isScreenFocused && hasVisibleLiveGames;

  useEffect(() => {
    if (!shouldPoll) {
      if (wasPollingRef.current) {
        const reason = !hasVisibleLiveGames
          ? 'No live/visible games (all final or none in progress)'
          : !isScreenFocused
            ? `${screen} lost focus`
            : !appIsActive
              ? 'App inactive'
              : 'Polling disabled';
        logEspnRefreshDev({
          source: 'ESPN',
          screen,
          trigger: 'idle',
          phase: 'poll-stop',
          activeLiveGames: liveCount,
          note: reason,
        });
        wasPollingRef.current = false;
      }
      return;
    }

    logEspnRefreshDev({
      source: 'ESPN',
      screen,
      trigger: 'live-interval',
      phase: 'poll-start',
      activeLiveGames: liveCount,
      note: `interval=${SCORES_LIVE_REFRESH_INTERVAL_MS}ms`,
    });
    wasPollingRef.current = true;

    const intervalId = setInterval(() => {
      void runSilentForceRefresh(`${prefix}-live-poll`);
    }, SCORES_LIVE_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    shouldPoll,
    runSilentForceRefresh,
    liveCount,
    hasVisibleLiveGames,
    isScreenFocused,
    appIsActive,
    prefix,
    screen,
  ]);
}
