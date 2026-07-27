import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ConferenceScheduleGameRow } from '@/components/conferences/ConferenceScheduleGameRow';
import { groupConferenceGamesByDate } from '@/data/conferences/groupConferenceGamesByDate';
import type { useConferenceWeekSchedule } from '@/data/conferences/useConferenceWeekSchedule';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { prioritizeFavoriteGamesWithinOrder } from '@/data/scores/prioritizeFavoriteScoreGames';
import { colors, spacing, typography } from '@/theme';

type ConferenceScheduleSectionProps = {
  schedule: ReturnType<typeof useConferenceWeekSchedule>;
};

export function ConferenceScheduleSection({
  schedule,
}: ConferenceScheduleSectionProps) {
  const { favorites, loaded: favoritesLoaded } = useFavoriteTeams();
  const { loadState, games, filteredGames, errorMessage } = schedule;

  const dateGroups = useMemo(() => {
    const baseGroups = groupConferenceGamesByDate(filteredGames);
    if (!favoritesLoaded || favorites.length === 0) {
      return baseGroups;
    }

    // Keep day sections intact; only reorder games inside each day.
    return baseGroups.map((group) => ({
      ...group,
      games: prioritizeFavoriteGamesWithinOrder(group.games, favorites),
    }));
  }, [filteredGames, favorites, favoritesLoaded]);

  return (
    <View style={styles.section}>
      {loadState === 'loading' ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load schedule</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {loadState === 'success' ? (
        <>
          {games.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No games for this week.</Text>
              <Text style={styles.emptyText}>Try another week when the schedule is available.</Text>
            </View>
          ) : dateGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No games scheduled for this conference this week.
              </Text>
            </View>
          ) : (
            <View style={styles.groupList}>
              {dateGroups.map((group) => (
                <View key={group.date} style={styles.dateSection}>
                  <Text style={styles.dateHeader}>{group.label}</Text>
                  <View style={styles.scoreboardList}>
                    {group.games.map((game, index) => (
                      <ConferenceScheduleGameRow
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
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
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
    borderRadius: 8,
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
