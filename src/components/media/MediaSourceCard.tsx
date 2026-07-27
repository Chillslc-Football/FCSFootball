import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveMediaScopeBadges } from '@/data/mediaDirectory/mediaScopeBadge';
import { hasMediaUrl, openMediaUrl } from '@/data/mediaDirectory/openMediaUrl';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

const LOGO_SIZE = 40;
const COMPACT_LOGO_SIZE = 36;

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function MediaSourceCard({
  source,
  variant = 'default',
}: {
  source: MediaSource;
  /** Compact: no coverage badges; hides empty-link placeholder. */
  variant?: 'default' | 'compact';
}) {
  const compact = variant === 'compact';
  const showSpotify = hasMediaUrl(source.spotify_url);
  const showYoutube = hasMediaUrl(source.youtube_url);
  const showX = hasMediaUrl(source.x_url);
  const hasAnyProvider = showSpotify || showYoutube || showX;
  const { labels: badgeLabels, overflowCount } = resolveMediaScopeBadges(source);
  const subtitle = source.subtitle?.trim() || null;
  const logoSize = compact ? COMPACT_LOGO_SIZE : LOGO_SIZE;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.headerRow}>
        {source.logo_url ? (
          <Image
            source={{ uri: source.logo_url }}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
          />
        ) : (
          <View style={[styles.logoFallback, { width: logoSize, height: logoSize }]}>
            <Text style={styles.logoInitials}>{initialsForName(source.name)}</Text>
          </View>
        )}
        <View style={styles.textBlock}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
            {source.name}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={compact ? 1 : 2}>
              {subtitle}
            </Text>
          ) : null}
          {!compact && badgeLabels.length > 0 ? (
            <View style={styles.badgeRow}>
              {badgeLabels.map((label) => (
                <View key={label} style={styles.badge}>
                  <Text style={styles.badgeText}>{label}</Text>
                </View>
              ))}
              {overflowCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{`+${overflowCount} more`}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {hasAnyProvider ? (
        <View style={styles.providerRow}>
          {showSpotify ? (
            <ProviderButton
              sourceName={source.name}
              label="Spotify"
              icon="musical-notes"
              onPress={() => void openMediaUrl(source.spotify_url)}
            />
          ) : null}
          {showYoutube ? (
            <ProviderButton
              sourceName={source.name}
              label="YouTube"
              icon="logo-youtube"
              onPress={() => void openMediaUrl(source.youtube_url)}
            />
          ) : null}
          {showX ? (
            <ProviderButton
              sourceName={source.name}
              label="X"
              icon="logo-twitter"
              onPress={() => void openMediaUrl(source.x_url)}
            />
          ) : null}
        </View>
      ) : compact ? null : (
        <Text style={styles.pendingLinks}>Media links coming soon</Text>
      )}
    </View>
  );
}

function ProviderButton({
  sourceName,
  label,
  icon,
  onPress,
}: {
  sourceName: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${sourceName} on ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.providerButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={styles.providerLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: spacing.xs + 2,
  },
  cardCompact: {
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  logo: {
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  logoFallback: {
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoInitials: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 13,
  },
  textBlock: { flex: 1, gap: 2, minWidth: 0 },
  name: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
  },
  nameCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  badge: {
    backgroundColor: 'rgba(201, 162, 39, 0.14)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  providerLabel: {
    ...typography.caption,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  pendingLinks: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  pressed: { opacity: 0.85 },
});
