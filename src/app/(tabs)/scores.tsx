import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { RankMergeDiagnostics } from '@/components/RankMergeDiagnostics';
import { GameFilterDropdown } from '@/components/GameFilterDropdown';
import { ScoresFilterDiagnosticsPanel } from '@/components/ScoresFilterDiagnosticsPanel';
import { Screen } from '@/components/Screen';
import { TodayGameCard } from '@/components/TodayGameCard';
import { WeekDropdown } from '@/components/WeekDropdown';
import { espnScoresProvider } from '@/data/providers/espnProvider';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import type { RankingMergeResult } from '@/data/providers/rankingMerge';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import {
  applyScoresFilter,
  collectScoresFilterDiagnostics,
  DEFAULT_SCORES_FILTER,
  getScoresFilterSupport,
  groupScoresByStatus,
  type ScoresFilterId,
} from '@/data/scores/scoresFilters';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame, ScheduleWeekId } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

const DEFAULT_SCORES_WEEK: ScheduleWeekId = 'week-1';

export default function ScoresScreen() {
  const [weekId, setWeekId] = useState<ScheduleWeekId>(DEFAULT_SCORES_WEEK);
  const [filterId, setFilterId] = useState<ScoresFilterId>(DEFAULT_SCORES_FILTER);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [mergeResult, setMergeResult] = useState<RankingMergeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      setLoadState('loading');
      setErrorMessage(null);

      try {
        const response = await espnScoresProvider.getWeekGames(weekId);
        if (cancelled) return;

        const merged = await mergeStaticRankingsOntoGames(response.data.games);
        if (cancelled) return;

        setGames(merged.games);
        registerEspnGames(merged.games);
        setMergeResult(merged);
        setSourceLabel(`${response.data.weekLabel} · ESPN scoreboard`);
        setLoadState('success');
      } catch (err) {
        if (cancelled) return;
        setGames([]);
        setMergeResult(null);
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load FCS scores from ESPN.',
        );
        setLoadState('error');
      }
    }

    void loadGames();

    return () => {
      cancelled = true;
    };
  }, [weekId]);

  const filterSupport = getScoresFilterSupport(filterId);

  const filteredGames = useMemo(
    () => applyScoresFilter(games, filterId),
    [games, filterId],
  );

  const filterDiagnostics = useMemo(
    () => collectScoresFilterDiagnostics(games, filterId),
    [games, filterId],
  );

  const statusGroups = useMemo(
    () => groupScoresByStatus(filteredGames),
    [filteredGames],
  );

  const isPlaceholderFilter = filterSupport === 'placeholder';
  const noGamesLoaded = games.length === 0;
  const showEmptyState =
    loadState === 'success' && (isPlaceholderFilter || noGamesLoaded || statusGroups.length === 0);

  return (
    <Screen title="Scores" subtitle="Browse FCS scores with conference and poll filters.">
      <View style={styles.dropdownStack}>
        <GameFilterDropdown selected={filterId} onSelect={setFilterId} />
        <WeekDropdown selected={weekId} onSelect={setWeekId} />
      </View>

      {loadState === 'loading' ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading FCS scores…</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load scores</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {loadState === 'success' ? (
        <>
          {showEmptyState ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {isPlaceholderFilter
                  ? 'Not enough data from ESPN yet'
                  : noGamesLoaded
                    ? 'No games loaded for this week'
                    : 'No games match this filter'}
              </Text>
              <Text style={styles.emptyText}>
                {isPlaceholderFilter
                  ? 'This filter needs additional ESPN or poll data that is not available on the FCS scoreboard feed yet.'
                  : noGamesLoaded
                    ? `ESPN returned 0 games for ${sourceLabel}. Try another week.`
                    : `${games.length} game${games.length === 1 ? '' : 's'} loaded, but this filter removed all of them. Try All FCS or another conference.`}
              </Text>
            </View>
          ) : (
            <View style={styles.groupList}>
              {statusGroups.map((group) => (
                <View key={group.key} style={styles.groupSection}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <View style={styles.list}>
                    {group.games.map((game, index) => (
                      <TodayGameCard
                        key={game.id}
                        game={game}
                        showDevDiagnostics={index === 0}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {__DEV__ ? (
            <>
              <ScoresFilterDiagnosticsPanel diagnostics={filterDiagnostics} />
              {mergeResult ? <RankMergeDiagnostics result={mergeResult} /> : null}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dropdownStack: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.lg,
  },
  errorTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
  },
  groupList: {
    gap: spacing.lg,
  },
  groupSection: {
    gap: spacing.sm,
  },
  groupTitle: {
    ...typography.label,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
