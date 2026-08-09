import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaArtwork } from '@/components/media/MediaArtwork';
import { formatMediaLinkActionLabel } from '@/data/mediaDirectory/mediaLinkRows';
import { MEDIA_PLATFORM_LINK_LABELS } from '@/data/mediaDirectory/mediaPlatformLinks';
import { formatMediaCoverageSummary } from '@/data/mediaDirectory/mediaScopeBadge';
import { getMediaSourceActionLinks } from '@/data/mediaDirectory/mediaSourceLinks';
import { getApprovedMediaSourceById } from '@/data/mediaDirectory/mediaSourcesApi';
import { openMediaUrl } from '@/data/mediaDirectory/openMediaUrl';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
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

export default function CreatorDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = firstParam(params.id);
  const sourceId = rawId ? decodeURIComponent(rawId) : '';

  const [source, setSource] = useState<MediaSource | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing'>('loading');

  const load = useCallback(async () => {
    setLoadState('loading');
    const found = await getApprovedMediaSourceById(sourceId);
    setSource(found);
    setLoadState(found ? 'ready' : 'missing');
  }, [sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const links = useMemo(
    () => (source ? getMediaSourceActionLinks(source) : []),
    [source],
  );
  const coverage = source ? formatMediaCoverageSummary(source, { maxBadges: 8 }) : null;
  const subtitle = source?.subtitle?.trim() || null;
  const description = source?.description?.trim() || null;
  const title = source?.name?.trim() || 'Creator';

  return (
    <>
      <Stack.Screen options={{ title, headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.xxl) },
        ]}
        showsVerticalScrollIndicator={false}>
        {loadState === 'loading' ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>Loading creator…</Text>
          </View>
        ) : null}

        {loadState === 'missing' ? (
          <View style={styles.centerBox}>
            <Text style={styles.missingTitle}>Creator not found</Text>
            <Text style={styles.centerText}>
              This media source is unavailable or no longer listed.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        ) : null}

        {loadState === 'ready' && source ? (
          <>
            <View style={styles.headerCard}>
              <MediaArtwork name={source.name} source={source} size={72} />
              <View style={styles.headerText}>
                <Text style={styles.name}>{source.name}</Text>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={3}>
                    {subtitle}
                  </Text>
                ) : null}
                {coverage ? (
                  <Text style={styles.coverage} numberOfLines={3}>
                    {coverage}
                  </Text>
                ) : null}
              </View>
            </View>

            {description ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>About</Text>
                <Text style={styles.description}>{description}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Links</Text>
              {links.length === 0 ? (
                <Text style={styles.emptyLinks}>No platform links listed yet.</Text>
              ) : (
                <View style={styles.linkList}>
                  {links.map((link) => {
                    const platformLabel =
                      MEDIA_PLATFORM_LINK_LABELS[link.platform] ?? link.platform;
                    const customLabel = link.label?.trim();
                    const primary = customLabel || platformLabel;
                    const secondary = customLabel ? platformLabel : null;
                    return (
                      <Pressable
                        key={`${link.platform}-${link.url}-${link.sortOrder}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${formatMediaLinkActionLabel(link)}`}
                        onPress={() => void openMediaUrl(link.url)}
                        style={({ pressed }) => [
                          styles.linkRow,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons
                          name={iconForPlatform(link.platform)}
                          size={20}
                          color={colors.primary}
                        />
                        <View style={styles.linkTextBlock}>
                          <Text style={styles.linkPrimary} numberOfLines={1}>
                            {primary}
                          </Text>
                          {secondary ? (
                            <Text style={styles.linkSecondary} numberOfLines={1}>
                              {secondary}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Are you this creator? Update your page"
              onPress={() =>
                router.push({
                  pathname: '/update-creator/[id]',
                  params: { id: source.id },
                })
              }
              style={({ pressed }) => [styles.updateCta, pressed && styles.pressed]}>
              <Text style={styles.updateCtaText}>Are you this creator? Update your page</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  centerBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  centerText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  missingTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  backButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  coverage: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  emptyLinks: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  linkList: {
    gap: spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 52,
  },
  linkTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  linkPrimary: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  linkSecondary: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  updateCta: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  updateCtaText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  pressed: { opacity: 0.85 },
});
