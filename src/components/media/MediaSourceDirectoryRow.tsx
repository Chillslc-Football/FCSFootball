import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaArtwork } from '@/components/media/MediaArtwork';
import { formatMediaCoverageSummary } from '@/data/mediaDirectory/mediaScopeBadge';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

const LOGO_SIZE = 44;

export function MediaSourceDirectoryRow({ source }: { source: MediaSource }) {
  const router = useRouter();
  const coverage = formatMediaCoverageSummary(source);
  const subtitle = source.subtitle?.trim() || null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${source.name}. Open creator details`}
      onPress={() => router.push(`/creator/${encodeURIComponent(source.id)}` as Href)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <MediaArtwork name={source.name} source={source} size={LOGO_SIZE} />
      <View style={styles.textBlock}>
        <Text style={styles.name} numberOfLines={2}>
          {source.name}
        </Text>
        {coverage ? (
          <Text style={styles.coverage} numberOfLines={1}>
            {coverage}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 64,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: colors.text,
  },
  coverage: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  pressed: { opacity: 0.85 },
});
