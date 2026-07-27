import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AddFavoriteTeamPicker } from '@/components/AddFavoriteTeamPicker';
import { FavoriteTeamRow } from '@/components/FavoriteTeamRow';
import { Screen } from '@/components/Screen';
import {
  buildPickableTeamsFromGames,
  pickableTeamToFavorite,
} from '@/data/favorites/buildPickableTeams';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import {
  enrichFavoriteTeam,
  findNextTeamGame,
} from '@/data/favorites/findNextTeamGame';
import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import {
  useScoresLiveRefresh,
  type ScoresSilentRefreshOptions,
} from '@/data/scores/useScoresLiveRefresh';
import { ensureSeasonGamesLoaded } from '@/data/teams/loadTeamSeasonGames';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';

type LoadState = 'loading' | 'success';

export default function FavoritesScreen() {
  const { favorites, loaded: favoritesLoaded, addFavorite } = useFavoriteTeams();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadScheduleData = useCallback(async (options?: ScoresSilentRefreshOptions & {
    pullRefresh?: boolean;
  }) => {
    const pullRefresh = options?.pullRefresh ?? false;
    const silent = options?.silent ?? false;
    const forceRefresh = options?.forceRefresh ?? pullRefresh;
    const trigger = options?.trigger ?? (pullRefresh ? 'favorites-ptr' : 'favorites-focus');

    if (!pullRefresh && !silent) {
      setLoadState('loading');
    }

    logEspnRefreshDev({
      source: 'ESPN',
      screen: 'Favorites',
      trigger,
      phase: 'start',
      note: `force=${forceRefresh}`,
    });

    try {
      const seasonGames = await ensureSeasonGamesLoaded({
        forceRefresh,
      });
      const merged = await mergeStaticRankingsOntoGames(seasonGames);
      setGames(merged.games);
      registerEspnGames(merged.games);
      logEspnRefreshDev({
        source: 'ESPN',
        screen: 'Favorites',
        trigger,
        phase: 'success',
        count: merged.games.length,
      });
    } catch (error) {
      logEspnRefreshDev({
        source: 'ESPN',
        screen: 'Favorites',
        trigger,
        phase: 'error',
        error,
      });
      console.warn(
        '[FavoritesScreen] schedule load failed; keeping previous favorites schedule when available:',
        error,
      );
      // Do not clear existing games on failure.
    } finally {
      setLoadState('success');
    }
  }, []);

  /** Games currently shown in favorite rows (each team's next/live game). */
  const visibleFavoriteGames = useMemo(() => {
    const visible: EspnNormalizedGame[] = [];
    for (const favorite of favorites) {
      try {
        const enriched = enrichFavoriteTeam(favorite, games);
        const next = findNextTeamGame(enriched, games);
        if (next?.game) visible.push(next.game);
      } catch (error) {
        console.warn('[FavoritesScreen] failed to resolve visible game:', error);
      }
    }
    return visible;
  }, [favorites, games]);

  useScoresLiveRefresh({
    screen: 'Favorites',
    visibleGames: visibleFavoriteGames,
    loadGames: loadScheduleData,
    // Focus/app-active refresh once favorites hydrate; interval only runs when a
    // visible next/live favorite game is in progress.
    enabled: favoritesLoaded,
  });

  const pickableTeams = useMemo(() => buildPickableTeamsFromGames(games), [games]);

  const { refreshing, onPullToRefresh } = usePullToRefresh(
    useCallback(async () => {
      await loadScheduleData({
        pullRefresh: true,
        forceRefresh: true,
        trigger: 'favorites-ptr',
      });
    }, [loadScheduleData]),
  );

  const isLoading = !favoritesLoaded || loadState === 'loading';
  const showEmptyFavorites = favoritesLoaded && favorites.length === 0;

  async function handleSelectTeam(team: ReturnType<typeof buildPickableTeamsFromGames>[number]) {
    await addFavorite(pickableTeamToFavorite(team));
    setPickerOpen(false);
  }

  return (
    <Screen
      denseTop
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onPullToRefresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }>
      {!isLoading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add favorite team"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addButtonText}>Add Favorite</Text>
        </Pressable>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading favorites…</Text>
        </View>
      ) : null}

      {!isLoading && showEmptyFavorites ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No favorite teams yet. Tap Add Favorite or the star on a team page.
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

      <AddFavoriteTeamPicker
        visible={pickerOpen}
        teams={pickableTeams}
        favorites={favorites}
        onClose={() => setPickerOpen(false)}
        onSelectTeam={(team) => void handleSelectTeam(team)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  addButtonPressed: {
    opacity: 0.75,
    backgroundColor: colors.surfaceElevated,
  },
  addButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
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
