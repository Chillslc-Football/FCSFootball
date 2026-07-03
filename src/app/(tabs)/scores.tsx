import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GameFilterDropdown } from '@/components/GameFilterDropdown';
import { ScoresGameCard } from '@/components/ScoresGameCard';
import { Screen } from '@/components/Screen';
import { WeekDropdown } from '@/components/WeekDropdown';
import { espnScoresProvider } from '@/data/providers/espnProvider';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import {
  prioritizeFavoriteScoreGames,
} from '@/data/scores/prioritizeFavoriteScoreGames';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import {
  applyScoresFilter,
  DEFAULT_SCORES_FILTER,
  getScoresFilterSupport,
  type ScoresFilterId,
} from '@/data/scores/scoresFilters';
import { colors, spacing, typography } from '@/theme';
import { extractLocalGameDateIso, formatGameDateLabel } from '@/utils/formatGameTime';
import { sortEspnNormalizedGames } from '@/utils/sortGames';
import type { EspnNormalizedGame, ScheduleWeekId } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

const DEFAULT_SCORES_WEEK: ScheduleWeekId = 'week-1';

type ScoresDateGroup = {
  date: string;
  label: string;
  games: EspnNormalizedGame[];
};

function groupScoresByDate(games: EspnNormalizedGame[]): ScoresDateGroup[] {
  const byDate = new Map<string, EspnNormalizedGame[]>();

  for (const game of games) {
    const dateKey = extractLocalGameDateIso(game.startTime);
    const bucket = byDate.get(dateKey) ?? [];
    bucket.push(game);
    byDate.set(dateKey, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b);
    })
    .map(([date, dateGames]) => ({
      date,
      label: formatGameDateLabel(date),
      games: sortEspnNormalizedGames(dateGames),
    }));
}

export default function ScoresScreen() {
  const { favorites, loaded: favoritesLoaded } = useFavoriteTeams();
  const [weekId, setWeekId] = useState<ScheduleWeekId>(DEFAULT_SCORES_WEEK);
  const [filterId, setFilterId] = useState<ScoresFilterId>(DEFAULT_SCORES_FILTER);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
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
        setSourceLabel(`${response.data.weekLabel} · ESPN scoreboard`);
        setLoadState('success');
      } catch (err) {
        if (cancelled) return;
        setGames([]);
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

  const dateGroups = useMemo(() => {
    const baseGroups = groupScoresByDate(filteredGames);
    if (!favoritesLoaded || favorites.length === 0) {
      return baseGroups;
    }

    const orderedGames = baseGroups.flatMap((group) => group.games);
    const { favoriteGames, otherGames } = prioritizeFavoriteScoreGames(orderedGames, favorites);

    if (favoriteGames.length === 0) {
      return baseGroups;
    }

    return [
      { date: '__favorites__', label: '', games: favoriteGames },
      ...groupScoresByDate(otherGames),
    ];
  }, [filteredGames, favorites, favoritesLoaded]);

  const isPlaceholderFilter = filterSupport === 'placeholder';
  const noGamesLoaded = games.length === 0;
  const showEmptyState =
    loadState === 'success' && (isPlaceholderFilter || noGamesLoaded || dateGroups.length === 0);

  return (
    <Screen denseTop>
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
              {dateGroups.map((group) => (
                <View key={group.date} style={styles.dateSection}>
                  {group.label ? (
                    <Text style={styles.dateHeader}>{group.label}</Text>
                  ) : null}
                  <View style={styles.scoreboardList}>
                    {group.games.map((game, index) => (
                      <ScoresGameCard
                        key={game.id}
                        game={game}
                        isLast={index === group.games.length - 1}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dropdownStack: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
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
    gap: spacing.md,
  },
  dateSection: {
    gap: spacing.xs,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  scoreboardList: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
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
