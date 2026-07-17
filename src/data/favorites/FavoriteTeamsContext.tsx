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
  addFavoriteTeam,
  favoriteTeamMatchesStored,
  loadFavoriteTeams,
  toggleFavoriteTeam,
} from '@/data/favorites/favoriteTeamsStorage';
import { reconcileFavoritesOnLaunch, syncFavoritesToBackend } from '@/data/notifications/favoritesSync';
import type { FavoriteTeam } from '@/types/favorites';

type FavoriteTeamsContextValue = {
  favorites: FavoriteTeam[];
  loaded: boolean;
  isFavorite: (teamId?: string, teamName?: string, abbreviation?: string) => boolean;
  toggleFavorite: (team: FavoriteTeam) => Promise<void>;
  addFavorite: (team: FavoriteTeam) => Promise<void>;
};

const FavoriteTeamsContext = createContext<FavoriteTeamsContextValue | null>(null);

export function FavoriteTeamsProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const teams = await loadFavoriteTeams();
        if (cancelled) return;
        setFavorites(teams);
        void reconcileFavoritesOnLaunch(teams);
      } catch (error) {
        console.warn('[FavoriteTeamsProvider] failed to load favorites:', error);
        if (!cancelled) setFavorites([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isFavorite = useCallback(
    (teamId?: string, teamName?: string, abbreviation?: string) => {
      try {
        if (!teamId && !teamName && !abbreviation) return false;
        return favorites.some((entry) =>
          favoriteTeamMatchesStored(entry, teamId, teamName, abbreviation),
        );
      } catch (error) {
        console.warn('[FavoriteTeamsProvider] isFavorite failed:', error);
        return false;
      }
    },
    [favorites],
  );

  const toggleFavorite = useCallback(
    async (team: FavoriteTeam) => {
      try {
        const next = await toggleFavoriteTeam(team, favorites);
        setFavorites(next);
        void syncFavoritesToBackend(next);
      } catch (error) {
        console.warn('[FavoriteTeamsProvider] toggleFavorite failed:', error);
      }
    },
    [favorites],
  );

  const addFavorite = useCallback(
    async (team: FavoriteTeam) => {
      try {
        const next = await addFavoriteTeam(team, favorites);
        setFavorites(next);
        void syncFavoritesToBackend(next);
      } catch (error) {
        console.warn('[FavoriteTeamsProvider] addFavorite failed:', error);
      }
    },
    [favorites],
  );

  const value = useMemo(
    () => ({ favorites, loaded, isFavorite, toggleFavorite, addFavorite }),
    [favorites, loaded, isFavorite, toggleFavorite, addFavorite],
  );

  return (
    <FavoriteTeamsContext.Provider value={value}>{children}</FavoriteTeamsContext.Provider>
  );
}

export function useFavoriteTeams(): FavoriteTeamsContextValue {
  const context = useContext(FavoriteTeamsContext);
  if (!context) {
    throw new Error('useFavoriteTeams must be used within FavoriteTeamsProvider');
  }
  return context;
}
