import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useMediaDirectoryController,
  type MediaTeamFilter,
} from '@/components/media/MediaDirectoryContent';
import { NewsArticleCard } from '@/components/NewsArticleCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useHeroSportsNews } from '@/data/news/useHeroSportsNews';
import { useTheAnalystNews } from '@/data/news/useTheAnalystNews';
import { colors, spacing, typography } from '@/theme';
import type { NewsSource } from '@/types/news';

const NEWS_SOURCE_OPTIONS: { id: NewsSource; label: string }[] = [
  { id: 'HERO Sports', label: 'HERO Sports' },
  { id: 'The Analyst', label: 'The Analyst' },
];

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
  const [selectedSource, setSelectedSource] = useState<NewsSource>('HERO Sports');
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

  const activeNews = selectedSource === 'HERO Sports' ? heroNews : analystNews;
  const { articles, loadState, isStale, errorMessage } = activeNews;

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

  const showEmpty = loadState === 'success' && articles.length === 0;
  const showError = loadState === 'error' && articles.length === 0;
  const refreshing = discoverSection === 'media' ? mediaRefreshing : pullRefreshing;

  const onPullToRefresh = useCallback(() => {
    if (discoverSection === 'media') {
      return refreshMedia();
    }
    return onPullToRefreshNews();
  }, [discoverSection, onPullToRefreshNews, refreshMedia]);

  const loadingMessage = useMemo(
    () =>
      selectedSource === 'HERO Sports'
        ? 'Loading FCS news…'
        : 'Loading The Analyst FCS news…',
    [selectedSource],
  );

  const emptyMessage =
    selectedSource === 'HERO Sports'
      ? 'No FCS news articles are available right now.'
      : 'No FCS news articles from The Analyst are available right now.';

  const errorMessageTitle =
    selectedSource === 'HERO Sports'
      ? 'FCS news could not be loaded. Pull down to try again.'
      : 'The Analyst news could not be loaded. Pull down to try again.';

  return (
    <Screen
      denseTop
      stickyHeader={
        <SegmentedControl
          options={DISCOVER_SECTION_OPTIONS}
          selected={discoverSection}
          onSelect={selectDiscoverSection}
          accessibilityLabel="Discover section"
          variant="accent"
          style={styles.primarySelector}
        />
      }
      secondaryStickyHeader={
        discoverSection === 'news' ? (
          <View style={styles.sourceSelectorWrap}>
            <SegmentedControl
              options={NEWS_SOURCE_OPTIONS}
              selected={selectedSource}
              onSelect={setSelectedSource}
              accessibilityLabel="News source"
              style={styles.sourceSelector}
            />
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onPullToRefresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }>
      {discoverSection === 'media' ? (
        mediaContent
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest News</Text>

          {loadState === 'loading' && articles.length === 0 ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.centerText}>{loadingMessage}</Text>
            </View>
          ) : null}

          {showError ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>{errorMessageTitle}</Text>
              {errorMessage ? <Text style={styles.messageDetail}>{errorMessage}</Text> : null}
            </View>
          ) : null}

          {isStale && articles.length > 0 ? (
            <View style={styles.staleBanner}>
              <Text style={styles.staleText}>
                {selectedSource} is stale or unavailable — showing the last successful feed.
              </Text>
              {__DEV__ && errorMessage ? (
                <Text style={styles.staleDetail}>{errorMessage}</Text>
              ) : null}
            </View>
          ) : null}

          {showEmpty ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>{emptyMessage}</Text>
            </View>
          ) : null}

          {articles.length > 0 ? (
            <View style={styles.list}>
              {articles.map((article, index) => (
                <NewsArticleCard
                  key={`${article.source}-${article.id}`}
                  article={article}
                  isLast={index === articles.length - 1}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  primarySelector: {
    marginTop: spacing.xs,
  },
  sourceSelectorWrap: {
    paddingHorizontal: spacing.lg,
  },
  sourceSelector: {
    marginTop: 0,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  list: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
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
