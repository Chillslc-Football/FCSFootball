import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatMediaLinkActionLabel,
  platformLinksToMediaLinkRows,
  type MediaLinkRow,
} from '@/data/mediaDirectory/mediaLinkRows';
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

function iconForPlatform(platform: string): keyof typeof Ionicons.glyphMap {
  switch (platform) {
    case 'spotify':
      return 'musical-notes';
    case 'youtube':
      return 'logo-youtube';
    case 'x':
      return 'logo-twitter';
    case 'apple':
      return 'logo-apple';
    case 'website':
      return 'globe-outline';
    case 'facebook':
      return 'logo-facebook';
    case 'instagram':
      return 'logo-instagram';
    case 'rss':
      return 'radio-outline';
    default:
      return 'link-outline';
  }
}

function resolveActionLinks(source: MediaSource): MediaLinkRow[] {
  if (source.links?.length) {
    return source.links.filter((link) => hasMediaUrl(link.url));
  }
  return platformLinksToMediaLinkRows({
    spotify: source.spotify_url ?? undefined,
    youtube: source.youtube_url ?? undefined,
    x: source.x_url ?? undefined,
    apple: source.apple_podcast_url ?? undefined,
  }).filter((link) => hasMediaUrl(link.url));
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
  const actionLinks = useMemo(() => resolveActionLinks(source), [source]);
  const hasAnyProvider = actionLinks.length > 0;
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
          {actionLinks.map((link) => {
            const label = formatMediaLinkActionLabel(link);
            return (
              <ProviderButton
                key={`${link.platform}-${link.url}-${link.sortOrder}`}
                sourceName={source.name}
                label={label}
                icon={iconForPlatform(link.platform)}
                onPress={() => void openMediaUrl(link.url)}
              />
            );
          })}
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
      accessibilityLabel={`Open ${sourceName} — ${label}`}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.providerButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={styles.providerLabel} numberOfLines={1}>
        {label}
      </Text>
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
    maxWidth: '100%',
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
    flexShrink: 1,
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
