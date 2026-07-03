import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FavoriteTeamRow } from '@/components/FavoriteTeamRow';
import { Screen } from '@/components/Screen';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import { ensureSeasonGamesLoaded } from '@/data/teams/loadTeamSeasonGames';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';

type LoadState = 'loading' | 'success';

export default function FavoritesScreen() {
  const { favorites, loaded: favoritesLoaded } = useFavoriteTeams();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);

  const loadScheduleData = useCallback(async () => {
    setLoadState('loading');

    try {
      const seasonGames = await ensureSeasonGamesLoaded();
      const merged = await mergeStaticRankingsOntoGames(seasonGames);
      setGames(merged.games);
      registerEspnGames(merged.games);
    } catch (error) {
      console.warn('[FavoritesScreen] schedule load failed; showing favorites without next games:', error);
      setGames([]);
    } finally {
      setLoadState('success');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadScheduleData().catch((error) => {
        console.warn('[FavoritesScreen] unexpected schedule load rejection:', error);
        setGames([]);
        setLoadState('success');
      });
    }, [loadScheduleData]),
  );

  const isLoading = !favoritesLoaded || loadState === 'loading';
  const showEmptyFavorites = favoritesLoaded && favorites.length === 0;

  return (
    <Screen denseTop>
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading favorites…</Text>
        </View>
      ) : null}

      {!isLoading && showEmptyFavorites ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No favorite teams yet. Tap the star on a team page to add one.
          </Text>
        </View>
      ) : null}

      {!isLoading && favorites.length > 0 ? (
        <View style={styles.list}>
          {favorites.map((favorite, index) => (
            <FavoriteTeamRow
              key={favorite.key || `${favorite.name}-${index}`}
              favorite={favorite}
              allGames={games}
              isLast={index === favorites.length - 1}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
