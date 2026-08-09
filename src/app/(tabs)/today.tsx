import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
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
import { HomeAnnouncementBanner } from '@/components/HomeAnnouncementBanner';
import { NewsArticleCard } from '@/components/NewsArticleCard';
import { Screen } from '@/components/Screen';
import { useHomeAnnouncement } from '@/data/announcement/useHomeAnnouncement';
import {
  buildPickableTeamsFromGames,
  pickableTeamToFavorite,
} from '@/data/favorites/buildPickableTeams';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import {
  enrichFavoriteTeam,
  findNextTeamGame,
} from '@/data/favorites/findNextTeamGame';
import { getNewsArticleKey, mergeNewsFeeds } from '@/data/news/newsUtils';
import { useHeroSportsNews } from '@/data/news/useHeroSportsNews';
import { useTheAnalystNews } from '@/data/news/useTheAnalystNews';
import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import { queueScoresFilterHandoff } from '@/data/scores/scoresFilterHandoff';
import type { ScoresFilterId } from '@/data/scores/scoresFilters';
import {
  useScoresLiveRefresh,
  type ScoresSilentRefreshOptions,
} from '@/data/scores/useScoresLiveRefresh';
import { ensureSeasonGamesLoaded } from '@/data/teams/loadTeamSeasonGames';
import {
  refreshCurrentWeekGamesIntoSeason,
  resolveSeasonRefreshMode,
} from '@/data/teams/seasonGamesRefresh';
import { getAllCachedEspnGames, registerEspnGames } from '@/data/teams/teamGamesStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';

type LoadState = 'loading' | 'success';

const HOME_NEWS_PREVIEW_COUNT = 3;

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, loaded: favoritesLoaded, addFavorite } = useFavoriteTeams();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const heroNews = useHeroSportsNews();
  const analystNews = useTheAnalystNews();
  const {
    announcement: homeAnnouncement,
    visible: homeAnnouncementVisible,
    dismiss: dismissHomeAnnouncement,
    refresh: refreshHomeAnnouncement,
  } = useHomeAnnouncement();

  const loadScheduleData = useCallback(async (options?: ScoresSilentRefreshOptions & {
    pullRefresh?: boolean;
  }) => {
    const pullRefresh = options?.pullRefresh ?? false;
    const silent = options?.silent ?? false;
    const forceRefresh = options?.forceRefresh ?? pullRefresh;
    const trigger = options?.trigger ?? (pullRefresh ? 'favorites-ptr' : 'favorites-focus');
    const refreshMode = resolveSeasonRefreshMode({
      pullRefresh,
      currentWeekOnly: options?.currentWeekOnly,
      trigger,
      hasSeasonCache: getAllCachedEspnGames().length > 0,
    });

    if (!pullRefresh && !silent) {
      setLoadState('loading');
    }

    logEspnRefreshDev({
      source: 'ESPN',
      screen: 'Favorites',
      trigger,
      phase: 'start',
      note: `force=${forceRefresh} mode=${refreshMode}`,
    });

    try {
      let seasonGames;
      let modeNote = 'season';
      if (refreshMode === 'current-week') {
        const refreshed = await refreshCurrentWeekGamesIntoSeason({ forceRefresh });
        seasonGames = refreshed.allGames;
        modeNote = `current-week ${refreshed.weekId} merged (${refreshed.weekGames.length} week games)`;
      } else {
        seasonGames = await ensureSeasonGamesLoaded({ forceRefresh });
      }

      const merged = await mergeStaticRankingsOntoGames(seasonGames);
      setGames(merged.games);
      registerEspnGames(merged.games);
      logEspnRefreshDev({
        source: 'ESPN',
        screen: 'Favorites',
        trigger,
        phase: 'success',
        count: merged.games.length,
        note: modeNote,
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

  const previewArticles = useMemo(
    () => mergeNewsFeeds([heroNews.articles, analystNews.articles]).slice(0, HOME_NEWS_PREVIEW_COUNT),
    [analystNews.articles, heroNews.articles],
  );

  const newsLoading =
    heroNews.loadState === 'loading' &&
    analystNews.loadState === 'loading' &&
    previewArticles.length === 0;

  const heroRefresh = heroNews.refresh;
  const analystRefresh = analystNews.refresh;

  const { refreshing, onPullToRefresh } = usePullToRefresh(
    useCallback(async () => {
      await Promise.allSettled([
        loadScheduleData({
          pullRefresh: true,
          forceRefresh: true,
          trigger: 'favorites-ptr',
        }),
        heroRefresh({ force: true, background: true }),
        analystRefresh({ force: true, background: true }),
        refreshHomeAnnouncement({ forceRefresh: true }),
      ]);
    }, [analystRefresh, heroRefresh, loadScheduleData, refreshHomeAnnouncement]),
  );

  const isLoading = !favoritesLoaded || loadState === 'loading';
  const showEmptyFavorites = favoritesLoaded && favorites.length === 0;

  async function handleSelectTeam(team: ReturnType<typeof buildPickableTeamsFromGames>[number]) {
    await addFavorite(pickableTeamToFavorite(team));
    setPickerOpen(false);
  }

  function openScoresWithFilter(filterId: ScoresFilterId) {
    queueScoresFilterHandoff(filterId);
    router.push('/(tabs)/scores' as Href);
  }

  function openAllNews() {
    router.push({ pathname: '/(tabs)/news', params: { section: 'news' } } as Href);
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
      {homeAnnouncementVisible && homeAnnouncement ? (
        <HomeAnnouncementBanner
          message={homeAnnouncement.message}
          onDismiss={() => void dismissHomeAnnouncement()}
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Teams</Text>

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
            <Text style={styles.loadingText}>Loading your teams…</Text>
          </View>
        ) : null}

        {!isLoading && showEmptyFavorites ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Home starts with your favorite teams. Tap Add Favorite or the star on a team page.
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Links</Text>
        <View style={styles.quickLinksRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open FCS Top 25 scores"
            onPress={() => openScoresWithFilter('fcs-top-25')}
            style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}>
            <Ionicons name="trophy-outline" size={18} color={colors.primary} />
            <Text style={styles.quickLinkText} numberOfLines={1}>
              FCS Top 25
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open FCS vs FBS scores"
            onPress={() => openScoresWithFilter('fcs-vs-fbs')}
            style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}>
            <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
            <Text style={styles.quickLinkText} numberOfLines={1}>
              FCS vs FBS
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest FCS News</Text>

        {newsLoading ? (
          <View style={styles.newsLoadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!newsLoading && previewArticles.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No headlines available right now.</Text>
          </View>
        ) : null}

        {previewArticles.length > 0 ? (
          <View style={styles.newsList}>
            {previewArticles.map((article, index) => (
              <NewsArticleCard
                key={getNewsArticleKey(article)}
                article={article}
                isLast={index === previewArticles.length - 1}
              />
            ))}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all FCS news"
          onPress={openAllNews}
          style={({ pressed }) => [styles.viewAllButton, pressed && styles.viewAllPressed]}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>

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
  section: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
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
  quickLinksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
  },
  quickLinkPressed: {
    opacity: 0.85,
    backgroundColor: colors.surfaceElevated,
  },
  quickLinkText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    flexShrink: 1,
  },
  newsLoadingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  newsList: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  viewAllPressed: {
    opacity: 0.75,
  },
  viewAllText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
});
