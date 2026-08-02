import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CONTEXTUAL_MEDIA_INLINE_LIMIT,
  SUGGEST_MEDIA_A11Y_LABEL,
  getMediaCreatorInitials,
} from '@/data/mediaDirectory/contextualMedia';
import { resolveMediaArtworkUrl } from '@/data/mediaDirectory/resolveMediaArtworkUrl';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

const TILE_ART_SIZE = 44;

function PreviewArtwork({ source }: { source: MediaSource }) {
  const artworkUrl = resolveMediaArtworkUrl(source);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [artworkUrl]);

  const showImage = Boolean(artworkUrl) && !failed;

  if (!showImage || !artworkUrl) {
    return (
      <View style={styles.artFrame} accessibilityElementsHidden>
        <Text style={styles.initials}>{getMediaCreatorInitials(source.name)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.artFrame}>
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: artworkUrl }}
        style={styles.artImage}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

export function ContextualMediaPreview({
  title,
  sources,
  emptyMessage,
  onViewAll,
  onSuggest,
  limit = CONTEXTUAL_MEDIA_INLINE_LIMIT,
}: {
  title: string;
  sources: MediaSource[];
  emptyMessage: string;
  onViewAll: () => void;
  onSuggest: () => void;
  limit?: number;
}) {
  const inline = sources.slice(0, limit);

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all media"
            hitSlop={8}
            onPress={onViewAll}
            style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SUGGEST_MEDIA_A11Y_LABEL}
            hitSlop={8}
            onPress={onSuggest}
            style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {inline.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          accessibilityRole="list">
          {inline.map((source) => (
            <View
              key={source.id}
              style={styles.tile}
              accessibilityRole="text"
              accessibilityLabel={source.name}>
              <PreviewArtwork source={source} />
              <Text style={styles.tileName} numberOfLines={2}>
                {source.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewAllButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  viewAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  tile: {
    width: 88,
    gap: spacing.xs,
    alignItems: 'center',
  },
  artFrame: {
    width: TILE_ART_SIZE,
    height: TILE_ART_SIZE,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artImage: {
    width: TILE_ART_SIZE,
    height: TILE_ART_SIZE,
    borderRadius: 8,
  },
  initials: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  tileName: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    width: '100%',
  },
  pressed: { opacity: 0.85 },
});
