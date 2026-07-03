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
  favoriteTeamMatchesStored,
  loadFavoriteTeams,
  toggleFavoriteTeam,
} from '@/data/favorites/favoriteTeamsStorage';
import type { FavoriteTeam } from '@/types/favorites';

type FavoriteTeamsContextValue = {
  favorites: FavoriteTeam[];
  loaded: boolean;
  isFavorite: (teamKey: string, teamName?: string) => boolean;
  toggleFavorite: (team: FavoriteTeam) => Promise<void>;
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
    (teamKey: string, teamName?: string) => {
      try {
        return favorites.some((entry) => favoriteTeamMatchesStored(entry, teamKey, teamName));
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
      } catch (error) {
        console.warn('[FavoriteTeamsProvider] toggleFavorite failed:', error);
      }
    },
    [favorites],
  );

  const value = useMemo(
    () => ({ favorites, loaded, isFavorite, toggleFavorite }),
    [favorites, loaded, isFavorite, toggleFavorite],
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
