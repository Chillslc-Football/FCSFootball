import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { isValidHeroSportsArticleUrl } from '@/data/news/heroSportsNewsProvider';
import {
  formatNewsPublishedDate,
  getNewsArticleKey,
  mergeNewsFeeds,
} from '@/data/news/newsUtils';
import { isValidTheAnalystArticleUrl } from '@/data/news/theAnalystNewsProvider';
import { useHeroSportsNews } from '@/data/news/useHeroSportsNews';
import { useTheAnalystNews } from '@/data/news/useTheAnalystNews';
import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import { prepareScoresFilterNavigation } from '@/data/scores/scoresFilterHandoff';
import {
  useScoresLiveRefresh,
  type ScoresSilentRefreshOptions,
} from '@/data/scores/useScoresLiveRefresh';
import { ensureSeasonGamesLoaded } from '@/data/teams/loadTeamSeasonGames';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';
import type { NewsArticle } from '@/types/news';

type LoadState = 'loading' | 'success';

const HOME_NEWS_LIMIT = 3;

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, loaded: favoritesLoaded, addFavorite } = useFavoriteTeams();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const {
    articles: heroArticles,
    loadState: heroLoadState,
    refresh: heroRefresh,
  } = useHeroSportsNews();
  const {
    articles: analystArticles,
    loadState: analystLoadState,
    refresh: analystRefresh,
  } = useTheAnalystNews();

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

  const latestNews = useMemo(
    () => mergeNewsFeeds([heroArticles, analystArticles]).slice(0, HOME_NEWS_LIMIT),
    [analystArticles, heroArticles],
  );

  const { refreshing, onPullToRefresh } = usePullToRefresh(
    useCallback(async () => {
      await Promise.all([
        loadScheduleData({
          pullRefresh: true,
          forceRefresh: true,
          trigger: 'favorites-ptr',
        }),
        heroRefresh({ force: true, background: true }),
        analystRefresh({ force: true, background: true }),
      ]);
    }, [analystRefresh, heroRefresh, loadScheduleData]),
  );

  const isLoading = !favoritesLoaded || loadState === 'loading';
  const showEmptyFavorites = favoritesLoaded && favorites.length === 0;

  async function handleSelectTeam(team: ReturnType<typeof buildPickableTeamsFromGames>[number]) {
    await addFavorite(pickableTeamToFavorite(team));
    setPickerOpen(false);
  }

  function openScoresFilter(filterId: 'fcs-top-25' | 'fcs-vs-fbs') {
    router.push(prepareScoresFilterNavigation(filterId));
  }

  function openMediaNews() {
    router.push({
      pathname: '/(tabs)/news',
      params: { section: 'news' },
    } as Href);
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
            accessibilityLabel="FCS Top 25 scores"
            onPress={() => openScoresFilter('fcs-top-25')}
            style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]}>
            <Text style={styles.quickLinkText}>FCS Top 25</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="FCS vs FBS scores"
            onPress={() => openScoresFilter('fcs-vs-fbs')}
            style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]}>
            <Text style={styles.quickLinkText}>FCS vs FBS</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest FCS News</Text>
        {latestNews.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {heroLoadState === 'loading' || analystLoadState === 'loading'
                ? 'Loading news…'
                : 'No FCS news articles are available right now.'}
            </Text>
          </View>
        ) : (
          <View style={styles.newsList}>
            {latestNews.map((article, index) => (
              <HomeNewsRow
                key={getNewsArticleKey(article)}
                article={article}
                isLast={index === latestNews.length - 1}
              />
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all FCS news"
          onPress={openMediaNews}
          style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
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

function isValidHomeNewsUrl(article: NewsArticle): boolean {
  if (article.source === 'HERO Sports') {
    return isValidHeroSportsArticleUrl(article.url);
  }
  return isValidTheAnalystArticleUrl(article.url);
}

function HomeNewsRow({ article, isLast }: { article: NewsArticle; isLast: boolean }) {
  const [opening, setOpening] = useState(false);
  const dateLabel = formatNewsPublishedDate(article.publishedAt);
  const meta = [article.source, dateLabel].filter(Boolean).join(' · ');

  async function handlePress() {
    if (opening || !isValidHomeNewsUrl(article)) return;
    setOpening(true);
    try {
      const canOpen = await Linking.canOpenURL(article.url);
      if (canOpen) {
        await Linking.openURL(article.url);
      }
    } catch {
      // Stay on Home if the link cannot open.
    } finally {
      setOpening(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${article.title} on ${article.source}`}
      onPress={() => void handlePress()}
      style={({ pressed }) => [
        styles.newsRow,
        !isLast && styles.newsRowBorder,
        pressed && styles.pressed,
      ]}>
      <View style={styles.newsText}>
        <Text style={styles.newsHeadline} numberOfLines={2}>
          {article.title}
        </Text>
        {meta ? (
          <Text style={styles.newsMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {opening ? <ActivityIndicator color={colors.primary} size="small" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
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
    padding: spacing.lg,
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
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  quickLinkText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  newsList: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 52,
  },
  newsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  newsText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  newsHeadline: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  newsMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  viewAllButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  viewAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  pressed: { opacity: 0.85 },
});
