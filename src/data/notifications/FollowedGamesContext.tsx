import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  disableGameAlerts,
  enableGameAlerts,
  isGameFollowed,
  loadFollowedGames,
} from '@/data/notifications/followedGamesSync';
import {
  loadGameNotificationManualPrefs,
  resolveGameAlertsEnabled,
  saveGameNotificationManualPrefs,
  setGameNotificationManualPref,
} from '@/data/notifications/gameNotificationPreferencesStorage';
import type { FollowedGameRecord } from '@/data/notifications/types';
import type { EspnNormalizedGame } from '@/types';

type FollowedGamesContextValue = {
  followedGames: FollowedGameRecord[];
  loaded: boolean;
  /** @deprecated Prefer isAlertsEnabled with favorite default. */
  isFollowed: (eventId: string) => boolean;
  isAlertsEnabled: (eventId: string, favoriteDefaultEnabled: boolean) => boolean;
  toggleAlerts: (game: EspnNormalizedGame, favoriteDefaultEnabled: boolean) => Promise<boolean>;
  enableAlerts: (game: EspnNormalizedGame) => Promise<boolean>;
  disableAlerts: (eventId: string) => Promise<boolean>;
  refreshFollowedGames: () => Promise<void>;
};

const FollowedGamesContext = createContext<FollowedGamesContextValue | null>(null);

async function loadManualPrefsWithMigration(
  followedGames: FollowedGameRecord[],
): Promise<Record<string, boolean>> {
  const prefs = await loadGameNotificationManualPrefs();
  const next = { ...prefs };
  let migrated = false;

  for (const record of followedGames) {
    if (!record.notificationsEnabled) continue;
    if (Object.prototype.hasOwnProperty.call(next, record.eventId)) continue;
    next[record.eventId] = true;
    migrated = true;
  }

  if (migrated) {
    await saveGameNotificationManualPrefs(next);
  }

  return next;
}

export function FollowedGamesProvider({ children }: { children: ReactNode }) {
  const [followedGames, setFollowedGames] = useState<FollowedGameRecord[]>([]);
  const [manualPrefs, setManualPrefs] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const refreshFollowedGames = useCallback(async () => {
    try {
      const records = await loadFollowedGames();
      setFollowedGames(records);
      const prefs = await loadManualPrefsWithMigration(records);
      setManualPrefs(prefs);
    } catch (error) {
      console.warn('[FollowedGamesProvider] refresh failed:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshFollowedGames();
  }, [refreshFollowedGames]);

  const isFollowed = useCallback(
    (eventId: string) => isGameFollowed(eventId, followedGames),
    [followedGames],
  );

  const isAlertsEnabled = useCallback(
    (eventId: string, favoriteDefaultEnabled: boolean) =>
      resolveGameAlertsEnabled(eventId, favoriteDefaultEnabled, manualPrefs),
    [manualPrefs],
  );

  const enableAlerts = useCallback(async (game: EspnNormalizedGame) => {
    try {
      const nextPrefs = await setGameNotificationManualPref(game.id, true);
      setManualPrefs(nextPrefs);
      const next = await enableGameAlerts(game);
      setFollowedGames(next);
      return true;
    } catch (error) {
      console.warn('[FollowedGamesProvider] enableAlerts failed:', error);
      return false;
    }
  }, []);

  const disableAlerts = useCallback(async (eventId: string) => {
    try {
      const nextPrefs = await setGameNotificationManualPref(eventId, false);
      setManualPrefs(nextPrefs);
      const next = await disableGameAlerts(eventId);
      setFollowedGames(next);
      return true;
    } catch (error) {
      console.warn('[FollowedGamesProvider] disableAlerts failed:', error);
      return false;
    }
  }, []);

  const toggleAlerts = useCallback(
    async (game: EspnNormalizedGame, favoriteDefaultEnabled: boolean) => {
      const currentlyEnabled = resolveGameAlertsEnabled(
        game.id,
        favoriteDefaultEnabled,
        manualPrefs,
      );
      if (currentlyEnabled) {
        return disableAlerts(game.id);
      }
      return enableAlerts(game);
    },
    [disableAlerts, enableAlerts, manualPrefs],
  );

  const value = useMemo(
    () => ({
      followedGames,
      loaded,
      isFollowed,
      isAlertsEnabled,
      toggleAlerts,
      enableAlerts,
      disableAlerts,
      refreshFollowedGames,
    }),
    [
      followedGames,
      loaded,
      isFollowed,
      isAlertsEnabled,
      toggleAlerts,
      enableAlerts,
      disableAlerts,
      refreshFollowedGames,
    ],
  );

  return (
    <FollowedGamesContext.Provider value={value}>{children}</FollowedGamesContext.Provider>
  );
}

export function useFollowedGames(): FollowedGamesContextValue {
  const context = useContext(FollowedGamesContext);
  if (!context) {
    throw new Error('useFollowedGames must be used within FollowedGamesProvider');
  }
  return context;
}
