import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaSourceCard } from '@/components/media/MediaSourceCard';
import { buildDiscoverTeamMediaHref } from '@/data/mediaDirectory/discoverMediaNavigation';
import { loadApprovedMediaSources } from '@/data/mediaDirectory/mediaSourcesApi';
import { filterMediaSourcesByTeam } from '@/data/mediaDirectory/mediaSourceValidation';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

const INLINE_LIMIT = 4;

export function TeamMediaSection({
  espnTeamId,
  teamName,
}: {
  espnTeamId: string;
  teamName: string;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<MediaSource[]>([]);

  const load = useCallback(async () => {
    const result = await loadApprovedMediaSources();
    setSources(result.sources);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const matching = useMemo(
    () =>
      filterMediaSourcesByTeam(sources, espnTeamId, {
        requireProviderUrl: true,
      }),
    [espnTeamId, sources],
  );

  const inline = matching.slice(0, INLINE_LIMIT);
  const hasMore = matching.length > INLINE_LIMIT;

  if (inline.length === 0) {
    return null;
  }

  const viewAllLabel = `View all ${teamName} media`;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Team Media</Text>
      <View style={styles.list}>
        {inline.map((source) => (
          <MediaSourceCard key={source.id} source={source} variant="compact" />
        ))}
      </View>
      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={viewAllLabel}
          onPress={() =>
            router.push(buildDiscoverTeamMediaHref(espnTeamId, teamName))
          }
          style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}>
          <Text style={styles.viewAllText}>{viewAllLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  list: {
    gap: spacing.sm - 2,
  },
  viewAll: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  viewAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  pressed: { opacity: 0.85 },
});
