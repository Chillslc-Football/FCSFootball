import { memo, useCallback, useMemo, useRef, useState } from 'react';
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
import { formatNewsPublishedDate } from '@/data/news/newsUtils';
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

function NewsArticleCardComponent({ article, isLast = false }: NewsArticleCardProps) {
  const [opening, setOpening] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const openingRef = useRef(false);

  const dateLabel = formatNewsPublishedDate(article.publishedAt);
  const metaParts = [article.author, dateLabel].filter(Boolean);
  const isHero = article.source === 'HERO Sports';
  const showImage = Boolean(article.imageUrl);
  const imageSource = useMemo(
    () => (article.imageUrl ? { uri: article.imageUrl } : null),
    [article.imageUrl],
  );

  const handlePress = useCallback(async () => {
    if (!isValidNewsArticleUrl(article) || openingRef.current) return;

    openingRef.current = true;
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
      openingRef.current = false;
      setOpening(false);
    }
  }, [article]);

  const handleImageError = useCallback(() => {
    setImageFailed(true);
  }, []);

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
      <View style={styles.content}>
        <Text style={[styles.source, isHero ? styles.sourceHero : styles.sourceAnalyst]}>
          {article.source}
        </Text>
        <Text style={styles.title}>{article.title}</Text>

        {metaParts.length > 0 ? (
          <Text style={styles.meta} numberOfLines={1}>
            {metaParts.join(' · ')}
          </Text>
        ) : null}

        {showImage ? (
          imageFailed || !imageSource ? (
            <View style={styles.image} accessibilityElementsHidden />
          ) : (
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="cover"
              onError={handleImageError}
            />
          )
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

export const NewsArticleCard = memo(NewsArticleCardComponent);

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
    marginTop: spacing.xs,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  source: {
    ...typography.label,
    letterSpacing: 0.4,
  },
  sourceHero: {
    color: colors.primary,
  },
  sourceAnalyst: {
    color: colors.accent,
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
    color: colors.textSecondary,
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
