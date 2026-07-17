import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { isValidHeroSportsArticleUrl } from '@/data/news/heroSportsNewsProvider';
import { isValidTheAnalystArticleUrl } from '@/data/news/theAnalystNewsProvider';
import { colors, spacing, typography } from '@/theme';
import type { NewsArticle } from '@/types/news';

type NewsArticleCardProps = {
  article: NewsArticle;
  isLast?: boolean;
};

function isValidNewsArticleUrl(article: NewsArticle): boolean {
  if (article.source === 'HERO Sports') {
    return isValidHeroSportsArticleUrl(article.url);
  }
  return isValidTheAnalystArticleUrl(article.url);
}

function formatPublishedDate(isoDate?: string): string | undefined {
  if (!isoDate) return undefined;

  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return undefined;

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(parsed));
  } catch {
    return undefined;
  }
}

export function NewsArticleCard({ article, isLast = false }: NewsArticleCardProps) {
  const [opening, setOpening] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const dateLabel = formatPublishedDate(article.publishedAt);
  const metaParts = [article.author, dateLabel].filter(Boolean);

  async function handlePress() {
    if (!isValidNewsArticleUrl(article) || opening) return;

    setOpening(true);
    try {
      const canOpen = await Linking.canOpenURL(article.url);
      if (!canOpen) {
        throw new Error('Unable to open this article link.');
      }
      await Linking.openURL(article.url);
    } catch {
      // Fail silently — user stays on the list.
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
        styles.card,
        !isLast && styles.cardBorder,
        pressed && styles.cardPressed,
      ]}>
      {article.imageUrl && !imageFailed ? (
        <Image
          source={{ uri: article.imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      <View style={styles.content}>
        <Text style={styles.source}>{article.source}</Text>
        <Text style={styles.title}>{article.title}</Text>

        {metaParts.length > 0 ? (
          <Text style={styles.meta} numberOfLines={1}>
            {metaParts.join(' · ')}
          </Text>
        ) : null}

        {article.excerpt ? (
          <Text style={styles.excerpt} numberOfLines={3}>
            {article.excerpt}
          </Text>
        ) : null}

        {opening ? (
          <View style={styles.openingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardPressed: {
    opacity: 0.85,
  },
  image: {
    width: '100%',
    height: 168,
    backgroundColor: colors.surfaceElevated,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  source: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 0.4,
  },
  title: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  excerpt: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  openingRow: {
    marginTop: spacing.xs,
  },
});
