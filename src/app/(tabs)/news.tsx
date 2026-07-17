import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NewsArticleCard } from '@/components/NewsArticleCard';
import { Screen } from '@/components/Screen';
import { useHeroSportsNews } from '@/data/news/useHeroSportsNews';
import { colors, spacing, typography } from '@/theme';

export default function NewsScreen() {
  const { articles, loadState, refreshing, isStale, errorMessage, onPullToRefresh } =
    useHeroSportsNews();

  const showEmpty = loadState === 'success' && articles.length === 0;
  const showError = loadState === 'error' && articles.length === 0;

  return (
    <Screen
      title="News"
      subtitle="FCS headlines from HERO Sports."
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

      {isStale && articles.length > 0 ? (
        <View style={styles.staleBanner}>
          <Text style={styles.staleText}>Showing cached stories — latest refresh failed.</Text>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>No FCS news articles are available right now.</Text>
        </View>
      ) : null}

      {articles.length > 0 ? (
        <View style={styles.list}>
          {articles.map((article, index) => (
            <NewsArticleCard
              key={article.id}
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
