import { Ionicons } from '@expo/vector-icons';
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
import { loadApprovedMediaSources } from '@/data/mediaDirectory/mediaSourcesApi';
import { filterMediaSources } from '@/data/mediaDirectory/mediaSourceValidation';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing, typography } from '@/theme';

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
  initialSearch?: string;
}): MediaDirectoryController {
  const showIntroSubtitle = options?.showIntroSubtitle ?? true;
  const teamFilter = options?.teamFilter ?? null;
  const onClearTeamFilter = options?.onClearTeamFilter;
  const [sources, setSources] = useState<MediaSource[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState(options?.initialSearch ?? '');

  const load = useCallback(async (forceRefresh = false) => {
    setErrorMessage(null);
    try {
      const result = await loadApprovedMediaSources({ forceRefresh });
      setSources(result.sources);
      setLoadState('success');
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
        search,
        teamId,
      }),
    [search, sources, teamId],
  );

  const emptyMessage = useMemo(() => {
    if (loadState === 'error' && sources.length === 0) {
      return 'We couldn’t load FCS media. Pull down to try again.';
    }
    if (search.trim()) {
      return 'No FCS media matches your search.';
    }
    if (teamId) {
      return `No media sources are linked to ${teamLabel} yet.`;
    }
    return 'No approved media sources yet.';
  }, [loadState, search, sources.length, teamId, teamLabel]);

  const content = (
    <View style={styles.root}>
      {showIntroSubtitle ? (
        <Text style={styles.subtitle}>Podcasts, videos, and creators from around the FCS</Text>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search creators and shows"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Link href={'/suggest-fcs-media' as Href} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Suggest FCS Media"
            hitSlop={8}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={24} color={colors.background} />
          </Pressable>
        </Link>
      </View>

      {teamId ? (
        <View style={styles.teamFilterRow}>
          <View style={styles.teamChip}>
            <Text style={styles.teamChipText}>{teamLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear team media filter"
            onPress={() => {
              onClearTeamFilter?.();
              setSearch('');
            }}
            style={({ pressed }) => [styles.clearTeamButton, pressed && styles.pressed]}>
            <Text style={styles.clearTeamText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

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
  root: { gap: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  search: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  list: { gap: spacing.sm + 2 },
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
  pressed: { opacity: 0.85 },
});
