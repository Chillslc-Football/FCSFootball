import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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

import { useMediaDirectoryController } from '@/components/media/MediaDirectoryContent';
import { NewsArticleCard } from '@/components/NewsArticleCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  buildDiscoverBrowseFilterFromHandoff,
  discoverMediaParamConsumptionKey,
  queueDiscoverMediaHandoff,
  resolveDiscoverMediaHandoffFromParams,
  takeDiscoverMediaHandoff,
  type DiscoverMediaBrowseSeed,
  type DiscoverMediaHandoffPayload,
} from '@/data/mediaDirectory/discoverMediaHandoff';
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

function clearDiscoverMediaRouteParams(
  router: ReturnType<typeof useRouter>,
  keepSectionMedia: boolean,
) {
  router.setParams({
    teamId: '',
    teamName: '',
    conferenceId: '',
    conferenceName: '',
    ...(keepSectionMedia ? { section: 'media' } : {}),
  });
}

export default function NewsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    section?: string | string[];
    teamId?: string | string[];
    teamName?: string | string[];
    conferenceId?: string | string[];
    conferenceName?: string | string[];
  }>();

  const [discoverSection, setDiscoverSection] = useState<DiscoverSection>(discoverSectionSession);
  const [browseFilterSeed, setBrowseFilterSeed] = useState<DiscoverMediaBrowseSeed | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const heroNews = useHeroSportsNews();
  const analystNews = useTheAnalystNews();
  const focusInFlightRef = useRef<Promise<void> | null>(null);
  const consumedParamKeyRef = useRef<string | null>(null);

  const selectDiscoverSection = useCallback((section: DiscoverSection) => {
    discoverSectionSession = section;
    setDiscoverSection(section);
  }, []);

  const applyHandoffPayload = useCallback(
    (payload: DiscoverMediaHandoffPayload, seedId: number) => {
      const filter = buildDiscoverBrowseFilterFromHandoff(payload);
      const hasFilter =
        filter.teams.length > 0 || filter.conferences.length > 0 || filter.national;
      selectDiscoverSection('media');
      if (hasFilter) {
        setBrowseFilterSeed({ id: seedId, filter });
      }
    },
    [selectDiscoverSection],
  );

  // Consume View All / deep-link filters on focus so tab navigators always receive them.
  useFocusEffect(
    useCallback(() => {
      const section = firstParam(params.section)?.toLowerCase();
      if (section === 'media') {
        selectDiscoverSection('media');
      } else if (section === 'news') {
        selectDiscoverSection('news');
      }

      const queued = takeDiscoverMediaHandoff();
      if (queued) {
        applyHandoffPayload(queued.payload, queued.id);
        consumedParamKeyRef.current = discoverMediaParamConsumptionKey(queued.payload);
        clearDiscoverMediaRouteParams(router, true);
        return;
      }

      const fromParams = resolveDiscoverMediaHandoffFromParams(params);
      if (!fromParams) return;

      const paramKey = discoverMediaParamConsumptionKey(fromParams);
      if (consumedParamKeyRef.current === paramKey) return;

      const handoff = queueDiscoverMediaHandoff(fromParams);
      // Immediately consume so a remount cannot re-queue the same route params.
      takeDiscoverMediaHandoff();
      consumedParamKeyRef.current = paramKey;
      applyHandoffPayload(fromParams, handoff.id);
      clearDiscoverMediaRouteParams(router, true);
    }, [applyHandoffPayload, params, router, selectDiscoverSection]),
  );

  const {
    refreshing: mediaRefreshing,
    onPullToRefresh: refreshMedia,
    content: mediaContent,
  } = useMediaDirectoryController({
    showIntroSubtitle: false,
    browseFilterSeed,
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
      accessibilityLabel="Media section"
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
    marginBottom: spacing.md,
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
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  centerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  messageBox: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  messageTitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  messageDetail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  staleBanner: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  staleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  staleDetail: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
