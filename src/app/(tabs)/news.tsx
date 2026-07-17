import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

export default function NewsScreen() {
  const [selectedSource, setSelectedSource] = useState<NewsSource>('HERO Sports');
  const heroNews = useHeroSportsNews();
  const analystNews = useTheAnalystNews();

  const activeNews = selectedSource === 'HERO Sports' ? heroNews : analystNews;
  const { articles, loadState, refreshing, isStale, errorMessage, onPullToRefresh } = activeNews;

  const showEmpty = loadState === 'success' && articles.length === 0;
  const showError = loadState === 'error' && articles.length === 0;

  const loadingMessage =
    selectedSource === 'HERO Sports'
      ? 'Loading FCS news…'
      : 'Loading The Analyst FCS news…';

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
      subtitle="FCS headlines from HERO Sports and The Analyst."
      stickyHeader={
        <SegmentedControl
          options={NEWS_SOURCE_OPTIONS}
          selected={selectedSource}
          onSelect={setSelectedSource}
          accessibilityLabel="News source"
          style={styles.sourceSelector}
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onPullToRefresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }>
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
          <Text style={styles.staleText}>Showing cached stories — latest refresh failed.</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  sourceSelector: {
    marginTop: spacing.sm,
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
  },
  staleText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
  },
});
