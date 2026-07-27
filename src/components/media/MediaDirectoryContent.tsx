import { Link, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MediaSourceCard } from '@/components/media/MediaSourceCard';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { loadApprovedMediaSources } from '@/data/mediaDirectory/mediaSourcesApi';
import { filterMediaSources } from '@/data/mediaDirectory/mediaSourceValidation';
import type { MediaDirectoryFilter, MediaSource } from '@/data/mediaDirectory/types';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing, typography } from '@/theme';

const FILTERS: { id: MediaDirectoryFilter; label: string }[] = [
  { id: 'national', label: 'National' },
  { id: 'my-teams', label: 'Favorites' },
  { id: 'all', label: 'All' },
];

export type MediaTeamFilter = {
  teamId: string;
  teamName?: string;
};

export type MediaDirectoryController = {
  refreshing: boolean;
  onPullToRefresh: () => Promise<void>;
  content: ReactNode;
};

/** Shared FCS Media directory state + UI for Discover and `/media`. */
export function useMediaDirectoryController(options?: {
  showIntroSubtitle?: boolean;
  teamFilter?: MediaTeamFilter | null;
  onClearTeamFilter?: () => void;
}): MediaDirectoryController {
  const showIntroSubtitle = options?.showIntroSubtitle ?? true;
  const teamFilter = options?.teamFilter ?? null;
  const onClearTeamFilter = options?.onClearTeamFilter;
  const { favorites, loaded: favoritesLoaded } = useFavoriteTeams();
  const [sources, setSources] = useState<MediaSource[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<MediaDirectoryFilter>('national');
  const [search, setSearch] = useState('');

  const favoriteTeamIds = useMemo(
    () =>
      favorites
        .map((favorite) => favorite.espnTeamId ?? favorite.key)
        .filter((id): id is string => Boolean(id)),
    [favorites],
  );

  const load = useCallback(async (forceRefresh = false) => {
    setErrorMessage(null);
    try {
      const result = await loadApprovedMediaSources({ forceRefresh });
      setSources(result.sources);
      setLoadState('success');
      if (result.error && result.fromSeed) {
        // Seed fallback still shows content; soft warning only in logs.
      }
    } catch (error) {
      setLoadState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load media.');
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const { refreshing, onPullToRefresh } = usePullToRefresh(
    useCallback(async () => {
      await load(true);
    }, [load]),
  );

  const teamId = teamFilter?.teamId?.trim() || null;
  const teamLabel = teamFilter?.teamName?.trim() || 'Team';

  const visible = useMemo(
    () =>
      filterMediaSources(sources, {
        filter,
        search,
        favoriteTeamIds,
        teamId,
      }),
    [favoriteTeamIds, filter, search, sources, teamId],
  );

  const emptyMessage = useMemo(() => {
    if (loadState === 'error' && sources.length === 0) {
      return 'We couldn’t load FCS media. Pull down to try again.';
    }
    if (search.trim()) {
      return 'No media sources match your search.';
    }
    if (teamId) {
      return `No media sources are linked to ${teamLabel} yet.`;
    }
    if (filter === 'my-teams' && favoritesLoaded && favorites.length === 0) {
      return 'Favorite a team to see its local creators here.';
    }
    if (filter === 'my-teams' && visible.length === 0) {
      return 'Favorite a team to see its local creators here.';
    }
    return 'No approved media sources yet.';
  }, [
    favorites.length,
    favoritesLoaded,
    filter,
    loadState,
    search,
    sources.length,
    teamId,
    teamLabel,
    visible.length,
  ]);

  const content = (
    <View style={styles.root}>
      {showIntroSubtitle ? (
        <Text style={styles.subtitle}>Podcasts, videos, and creators from around the FCS</Text>
      ) : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search creators and shows"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {teamId ? (
        <View style={styles.teamFilterRow}>
          <View style={styles.teamChip}>
            <Text style={styles.teamChipText}>{teamLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear team media filter"
            onPress={onClearTeamFilter}
            style={({ pressed }) => [styles.clearTeamButton, pressed && styles.pressed]}>
            <Text style={styles.clearTeamText}>Clear</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.filterRow}>
          {FILTERS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setFilter(option.id)}
              style={[styles.chip, filter === option.id && styles.chipSelected]}>
              <Text style={[styles.chipText, filter === option.id && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Link href={'/suggest-fcs-media' as Href} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Suggest FCS Media"
          style={({ pressed }) => [styles.suggestButton, pressed && styles.pressed]}>
          <Text style={styles.suggestTitle}>Suggest FCS Media</Text>
          <Text style={styles.suggestSub}>Share a Spotify, YouTube, or X link for review</Text>
        </Pressable>
      </Link>

      {loadState === 'loading' && sources.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>Loading FCS media…</Text>
        </View>
      ) : null}

      {errorMessage && sources.length === 0 ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{emptyMessage}</Text>
        </View>
      ) : null}

      {loadState !== 'loading' && visible.length === 0 ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{emptyMessage}</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {visible.map((source) => (
          <MediaSourceCard key={source.id} source={source} />
        ))}
      </View>

      <View style={styles.applePlaceholder}>
        <Text style={styles.appleTitle}>Apple Podcasts</Text>
        <Text style={styles.appleSub}>Coming with iPhone app</Text>
      </View>
    </View>
  );

  return { refreshing, onPullToRefresh, content };
}

/** Inline media directory content (no ScrollView — parent owns scrolling). */
export function MediaDirectoryContent({
  showIntroSubtitle = true,
  teamFilter = null,
  onClearTeamFilter,
}: {
  showIntroSubtitle?: boolean;
  teamFilter?: MediaTeamFilter | null;
  onClearTeamFilter?: () => void;
}) {
  const { content } = useMediaDirectoryController({
    showIntroSubtitle,
    teamFilter,
    onClearTeamFilter,
  });
  return <>{content}</>;
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  teamFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  teamChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  teamChipText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  clearTeamButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearTeamText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.background, fontWeight: '700' },
  suggestButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  suggestTitle: {
    ...typography.body,
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
  },
  suggestSub: { ...typography.caption, color: colors.textSecondary },
  list: { gap: spacing.sm - 2, marginTop: spacing.xs },
  centerBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  centerText: { ...typography.body, color: colors.textSecondary },
  messageBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
  },
  messageText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  applePlaceholder: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.surface,
    opacity: 0.7,
  },
  appleTitle: { ...typography.body, color: colors.textMuted, fontWeight: '700' },
  appleSub: { ...typography.caption, color: colors.textMuted },
  pressed: { opacity: 0.85 },
});
