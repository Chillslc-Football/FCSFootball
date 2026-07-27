import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';

import {
  useMediaDirectoryController,
  type MediaTeamFilter,
} from '@/components/media/MediaDirectoryContent';
import { NewsArticleCard } from '@/components/NewsArticleCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { getNewsArticleKey, mergeNewsFeeds } from '@/data/news/newsUtils';
import { useHeroSportsNews } from '@/data/news/useHeroSportsNews';
import { useTheAnalystNews } from '@/data/news/useTheAnalystNews';
import { colors, spacing, typography } from '@/theme';
import type { NewsArticle } from '@/types/news';

type DiscoverSection = 'news' | 'media';

const DISCOVER_SECTION_OPTIONS: { id: DiscoverSection; label: string }[] = [
  { id: 'news', label: 'News' },
  { id: 'media', label: 'Media' },
];

/** In-session Discover section preference (no new storage). */
let discoverSectionSession: DiscoverSection = 'news';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function NewsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    section?: string | string[];
    teamId?: string | string[];
    teamName?: string | string[];
  }>();

  const [discoverSection, setDiscoverSection] = useState<DiscoverSection>(discoverSectionSession);
  const [teamFilter, setTeamFilter] = useState<MediaTeamFilter | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const heroNews = useHeroSportsNews();
  const analystNews = useTheAnalystNews();
  const focusInFlightRef = useRef<Promise<void> | null>(null);

  const selectDiscoverSection = useCallback((section: DiscoverSection) => {
    discoverSectionSession = section;
    setDiscoverSection(section);
  }, []);

  const clearTeamFilter = useCallback(() => {
    setTeamFilter(null);
    router.setParams({ teamId: '', teamName: '' });
  }, [router]);

  // Apply deep-link / View all params: Media + optional team filter.
  useEffect(() => {
    const section = firstParam(params.section)?.toLowerCase();
    const teamIdRaw = firstParam(params.teamId);
    const teamId = teamIdRaw?.trim();
    const teamName = firstParam(params.teamName)?.trim();

    if (section === 'media' || teamId) {
      selectDiscoverSection('media');
    }

    if (teamId) {
      setTeamFilter({ teamId, teamName });
    } else if (teamIdRaw === '') {
      setTeamFilter(null);
    }
  }, [params.section, params.teamId, params.teamName, selectDiscoverSection]);

  const {
    refreshing: mediaRefreshing,
    onPullToRefresh: refreshMedia,
    content: mediaContent,
  } = useMediaDirectoryController({
    showIntroSubtitle: false,
    teamFilter,
    onClearTeamFilter: clearTeamFilter,
  });

  const articles = useMemo(
    () => mergeNewsFeeds([heroNews.articles, analystNews.articles]),
    [analystNews.articles, heroNews.articles],
  );

  const bothLoading =
    heroNews.loadState === 'loading' && analystNews.loadState === 'loading';
  const bothError =
    heroNews.loadState === 'error' && analystNews.loadState === 'error';
  const anyStale = heroNews.isStale || analystNews.isStale;
  const showEmpty =
    !bothLoading &&
    articles.length === 0 &&
    (heroNews.loadState === 'success' || analystNews.loadState === 'success');
  const showError = bothError && articles.length === 0;
  const errorMessage = [heroNews.errorMessage, analystNews.errorMessage]
    .filter(Boolean)
    .join(' · ') || null;

  const heroRefresh = heroNews.refresh;
  const analystRefresh = analystNews.refresh;

  const refreshBothSources = useCallback(
    async (options: { background?: boolean; force?: boolean } = {}) => {
      const results = await Promise.allSettled([
        heroRefresh({
          background: options.background ?? true,
          force: options.force,
        }),
        analystRefresh({
          background: options.background ?? true,
          force: options.force,
        }),
      ]);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const sourceName = index === 0 ? 'HERO Sports' : 'The Analyst';
          console.warn(`[NewsScreen] ${sourceName} refresh rejected:`, result.reason);
        }
      });
    },
    [analystRefresh, heroRefresh],
  );

  useFocusEffect(
    useCallback(() => {
      if (discoverSectionSession !== 'news') {
        return;
      }
      if (focusInFlightRef.current) {
        return;
      }

      const run = refreshBothSources({ background: true }).finally(() => {
        if (focusInFlightRef.current === run) {
          focusInFlightRef.current = null;
        }
      });
      focusInFlightRef.current = run;
    }, [refreshBothSources]),
  );

  const onPullToRefreshNews = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await refreshBothSources({ force: true, background: true });
    } finally {
      setPullRefreshing(false);
    }
  }, [refreshBothSources]);

  const discoverHeader = (
    <SegmentedControl
      options={DISCOVER_SECTION_OPTIONS}
      selected={discoverSection}
      onSelect={selectDiscoverSection}
      accessibilityLabel="Discover section"
      variant="accent"
      style={styles.primarySelector}
    />
  );

  const keyExtractor = useCallback((item: NewsArticle) => getNewsArticleKey(item), []);

  const renderItem: ListRenderItem<NewsArticle> = useCallback(
    ({ item, index }) => {
      const isFirst = index === 0;
      const isLast = index === articles.length - 1;
      return (
        <View
          style={[
            styles.listRow,
            isFirst && styles.listRowFirst,
            isLast && styles.listRowLast,
          ]}>
          <NewsArticleCard article={item} isLast={isLast} />
        </View>
      );
    },
    [articles.length],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Latest News</Text>

        {bothLoading && articles.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.centerText}>Loading FCS news…</Text>
          </View>
        ) : null}

        {showError ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageTitle}>
              FCS news could not be loaded. Pull down to try again.
            </Text>
            {errorMessage ? <Text style={styles.messageDetail}>{errorMessage}</Text> : null}
          </View>
        ) : null}

        {anyStale && articles.length > 0 ? (
          <View style={styles.staleBanner}>
            <Text style={styles.staleText}>
              One or more sources are stale or unavailable — showing the last successful feeds.
            </Text>
            {__DEV__ && errorMessage ? (
              <Text style={styles.staleDetail}>{errorMessage}</Text>
            ) : null}
          </View>
        ) : null}

        {showEmpty ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageTitle}>
              No FCS news articles are available right now.
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [
      anyStale,
      articles.length,
      bothLoading,
      errorMessage,
      showEmpty,
      showError,
    ],
  );

  if (discoverSection === 'media') {
    return (
      <Screen
        denseTop
        stickyHeader={discoverHeader}
        refreshControl={
          <RefreshControl
            refreshing={mediaRefreshing}
            onRefresh={() => void refreshMedia()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        {mediaContent}
      </Screen>
    );
  }

  return (
    <Screen denseTop stickyHeader={discoverHeader} scrollEnabled={false}>
      <FlatList
        style={styles.list}
        data={articles}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void onPullToRefreshNews()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  primarySelector: {
    marginTop: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  listRow: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  listRowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  listRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  listHeader: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  centerBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  centerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  messageBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  messageTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  messageDetail: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  staleBanner: {
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  staleText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
  },
  staleDetail: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
