import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MediaBrowseFilterChips, MediaBrowseSheet } from '@/components/media/MediaBrowseSheet';
import { MediaSourceDirectoryRow } from '@/components/media/MediaSourceDirectoryRow';
import type { DiscoverMediaBrowseSeed } from '@/data/mediaDirectory/discoverMediaHandoff';
import {
  buildMediaBrowseTeamOptions,
  createEmptyMediaBrowseFilter,
  filterMediaSourcesByBrowse,
  getMediaBrowseBadgeLetter,
  getMediaBrowseChips,
  getMediaBrowseConferenceOptions,
  isMediaBrowseFilterActive,
  removeMediaBrowseChip,
  type MediaBrowseFilter,
} from '@/data/mediaDirectory/mediaBrowse';
import { loadApprovedMediaSources } from '@/data/mediaDirectory/mediaSourcesApi';
import { filterMediaSources } from '@/data/mediaDirectory/mediaSourceValidation';
import { getAllCachedEspnGames } from '@/data/teams/teamGamesStore';
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
  /**
   * Apply a View All / deep-link browse filter exactly once per seed id.
   * Manual chip edits afterward are preserved until a new seed arrives.
   */
  browseFilterSeed?: DiscoverMediaBrowseSeed | null;
  initialSearch?: string;
}): MediaDirectoryController {
  const showIntroSubtitle = options?.showIntroSubtitle ?? true;
  const teamFilter = options?.teamFilter ?? null;
  const onClearTeamFilter = options?.onClearTeamFilter;
  const browseFilterSeed = options?.browseFilterSeed ?? null;
  const [sources, setSources] = useState<MediaSource[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState(options?.initialSearch ?? '');
  const [browseFilter, setBrowseFilter] = useState<MediaBrowseFilter>(() =>
    browseFilterSeed?.filter ?? createEmptyMediaBrowseFilter(),
  );
  const [browseOpen, setBrowseOpen] = useState(false);

  const appliedBrowseSeedIdRef = useRef<number | null>(browseFilterSeed?.id ?? null);
  useEffect(() => {
    if (!browseFilterSeed) return;
    if (appliedBrowseSeedIdRef.current === browseFilterSeed.id) return;
    appliedBrowseSeedIdRef.current = browseFilterSeed.id;
    setBrowseFilter(browseFilterSeed.filter);
  }, [browseFilterSeed]);

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

  const approvedSources = useMemo(
    () => filterMediaSources(sources, { search: '', teamId: null }),
    [sources],
  );

  const browseTeams = useMemo(
    () => buildMediaBrowseTeamOptions(approvedSources, getAllCachedEspnGames()),
    // Recompute when the sheet opens so newly cached ESPN games appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- browseOpen intentionally refreshes cache read
    [approvedSources, browseOpen],
  );

  const browseConferences = useMemo(() => getMediaBrowseConferenceOptions(), []);

  const searched = useMemo(
    () =>
      filterMediaSources(sources, {
        search,
        teamId,
      }),
    [search, sources, teamId],
  );

  const visible = useMemo(
    () => filterMediaSourcesByBrowse(searched, browseFilter),
    [searched, browseFilter],
  );

  const browseChips = useMemo(() => getMediaBrowseChips(browseFilter), [browseFilter]);
  const badgeLetter = getMediaBrowseBadgeLetter(browseFilter);
  const browseActive = isMediaBrowseFilterActive(browseFilter);
  const noBrowseMatches =
    loadState !== 'loading' && searched.length > 0 && visible.length === 0 && browseActive;

  const emptyMessage = useMemo(() => {
    if (loadState === 'error' && sources.length === 0) {
      return 'We couldn’t load FCS media. Pull down to try again.';
    }
    if (noBrowseMatches) {
      return 'No media sources match these filters.';
    }
    if (search.trim()) {
      return 'No FCS media matches your search.';
    }
    if (teamId) {
      return `No media sources are linked to ${teamLabel} yet.`;
    }
    return 'No approved media sources yet.';
  }, [loadState, noBrowseMatches, search, sources.length, teamId, teamLabel]);

  const content = (
    <View style={styles.root}>
      {showIntroSubtitle ? (
        <Text style={styles.subtitle}>Podcasts, videos, and creators from around the FCS</Text>
      ) : null}

      <View style={styles.controls}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search creators and shows"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              browseActive
                ? `Filter media, ${browseChips.length} filters active`
                : 'Filter media'
            }
            hitSlop={8}
            onPress={() => setBrowseOpen(true)}
            style={({ pressed }) => [
              styles.actionButton,
              styles.filterButton,
              browseActive && styles.filterButtonActive,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name="filter-outline"
              size={18}
              color={browseActive ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[styles.filterButtonLabel, browseActive && styles.filterButtonLabelActive]}
              numberOfLines={1}>
              {badgeLetter ? `Filter · ${badgeLetter}` : 'Filter'}
            </Text>
          </Pressable>

          <Link href={'/suggest-fcs-media' as Href} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add Creator"
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionButton,
                styles.addCreatorButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.addCreatorLabel}>+ Add Creator</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {browseChips.length > 0 ? (
        <MediaBrowseFilterChips
          chips={browseChips}
          onRemove={(chip) => setBrowseFilter((current) => removeMediaBrowseChip(current, chip))}
        />
      ) : null}

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
          {noBrowseMatches ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              onPress={() => setBrowseFilter(createEmptyMediaBrowseFilter())}
              style={({ pressed }) => [styles.clearFiltersButton, pressed && styles.pressed]}>
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.list}>
        {visible.map((source) => (
          <MediaSourceDirectoryRow key={source.id} source={source} />
        ))}
      </View>

      <MediaBrowseSheet
        visible={browseOpen}
        activeFilter={browseFilter}
        teams={browseTeams}
        conferences={browseConferences}
        onClose={() => setBrowseOpen(false)}
        onChangeFilter={setBrowseFilter}
      />
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
  controls: {
    gap: spacing.xs,
  },
  search: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  filterButton: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
  },
  filterButtonLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonLabelActive: {
    color: colors.primary,
  },
  addCreatorButton: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  addCreatorLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
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
    gap: spacing.sm,
    alignItems: 'center',
  },
  messageText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  clearFiltersButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  clearFiltersText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  pressed: { opacity: 0.85 },
});
