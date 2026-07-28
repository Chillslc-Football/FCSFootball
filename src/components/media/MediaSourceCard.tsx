import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveMediaScopeBadges } from '@/data/mediaDirectory/mediaScopeBadge';
import { hasMediaUrl, openMediaUrl } from '@/data/mediaDirectory/openMediaUrl';
import { resolveMediaArtworkUrl } from '@/data/mediaDirectory/resolveMediaArtworkUrl';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

const LOGO_SIZE = 48;
const COMPACT_LOGO_SIZE = 40;

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function resolveScopeMeta(source: MediaSource): string | null {
  const { labels, overflowCount } = resolveMediaScopeBadges(source);
  if (labels.length === 0) return null;
  const base = labels.join(' · ');
  return overflowCount > 0 ? `${base} · +${overflowCount} more` : base;
}

function resolveShortDescription(source: MediaSource): string | null {
  const subtitle = source.subtitle?.trim();
  if (subtitle) return subtitle;
  const description = source.description?.trim();
  return description || null;
}

function MediaArtwork({
  name,
  source,
  size,
}: {
  name: string;
  source: MediaSource;
  size: number;
}) {
  const artworkUrl = resolveMediaArtworkUrl(source);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [artworkUrl]);

  const showImage = Boolean(artworkUrl) && !failed;
  const frameStyle = [styles.artworkFrame, { width: size, height: size, borderRadius: 8 }];

  if (!showImage || !artworkUrl) {
    return (
      <View style={frameStyle} accessibilityElementsHidden>
        <Text style={[styles.logoInitials, size <= 40 && styles.logoInitialsCompact]}>
          {initialsForName(name)}
        </Text>
      </View>
    );
  }

  return (
    <View style={frameStyle}>
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: artworkUrl }}
        style={{ width: size, height: size, borderRadius: 8 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

export function MediaSourceCard({
  source,
  variant = 'default',
}: {
  source: MediaSource;
  /** Compact: quieter meta; hides empty-link placeholder. */
  variant?: 'default' | 'compact';
}) {
  const compact = variant === 'compact';
  const showSpotify = hasMediaUrl(source.spotify_url);
  const showYoutube = hasMediaUrl(source.youtube_url);
  const showX = hasMediaUrl(source.x_url);
  const showApplePodcasts = hasMediaUrl(source.apple_podcast_url);
  const hasAnyProvider = showSpotify || showYoutube || showX || showApplePodcasts;
  const scopeMeta = resolveScopeMeta(source);
  const shortDescription = resolveShortDescription(source);
  const logoSize = compact ? COMPACT_LOGO_SIZE : LOGO_SIZE;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.headerRow}>
        <MediaArtwork name={source.name} source={source} size={logoSize} />
        <View style={styles.textBlock}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
            {source.name}
          </Text>
          {scopeMeta && !compact ? (
            <Text style={styles.scopeMeta} numberOfLines={1}>
              {scopeMeta}
            </Text>
          ) : null}
          {shortDescription ? (
            <Text style={styles.description} numberOfLines={compact ? 1 : 2}>
              {shortDescription}
            </Text>
          ) : null}
        </View>
      </View>

      {hasAnyProvider ? (
        <View style={[styles.providerRow, compact && styles.providerRowCompact]}>
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
          {showApplePodcasts ? (
            <ProviderButton
              sourceName={source.name}
              label="Apple"
              accessibilityLabel="Apple Podcasts"
              icon="logo-apple"
              onPress={() => void openMediaUrl(source.apple_podcast_url)}
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
  accessibilityLabel,
  icon,
  onPress,
}: {
  sourceName: string;
  label: string;
  accessibilityLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const a11y = accessibilityLabel ?? label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${sourceName} on ${a11y}`}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.providerButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={styles.providerLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md - 2,
    paddingBottom: spacing.sm + 2,
    gap: spacing.sm,
  },
  cardCompact: {
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs + 2,
    borderRadius: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  artworkFrame: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoInitials: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 14,
  },
  logoInitialsCompact: {
    fontSize: 12,
  },
  textBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: colors.text,
  },
  nameCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  scopeMeta: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  description: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  providerRowCompact: {
    paddingTop: spacing.xs + 2,
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  providerLabel: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pendingLinks: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: { opacity: 0.85 },
});
