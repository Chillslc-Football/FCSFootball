import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ScheduleGameCard } from '@/components/ScheduleGameCard';
import { Screen } from '@/components/Screen';
import {
  MOCK_SCHEDULE_CONFERENCES,
  MOCK_SCHEDULE_GAMES,
  MOCK_SCHEDULE_TODAY,
  formatScheduleDate,
  shiftScheduleDate,
} from '@/data/mock/schedule';
import type { MockScheduleConference } from '@/data/mock/schedule';
import { colors, spacing, typography } from '@/theme';
import type { ScheduleGame } from '@/types';

function filterGames(
  games: ScheduleGame[],
  date: string,
  conference: MockScheduleConference,
  top25Only: boolean,
): ScheduleGame[] {
  return games.filter((game) => {
    if (game.date !== date) return false;
    if (conference !== 'All Conferences' && game.conference !== conference) return false;
    if (top25Only && !game.awayTeam.rank && !game.homeTeam.rank) return false;
    return true;
  });
}

export default function ScheduleScreen() {
  const [selectedDate, setSelectedDate] = useState(MOCK_SCHEDULE_TODAY);
  const [conference, setConference] = useState<MockScheduleConference>('All Conferences');
  const [top25Only, setTop25Only] = useState(false);

  const filteredGames = useMemo(
    () => filterGames(MOCK_SCHEDULE_GAMES, selectedDate, conference, top25Only),
    [selectedDate, conference, top25Only],
  );

  const isToday = selectedDate === MOCK_SCHEDULE_TODAY;

  return (
    <Screen title="Schedule" subtitle="Upcoming FCS matchups and kickoff times.">
      <View style={styles.mockBanner}>
        <Text style={styles.mockLabel}>Mock Data</Text>
        <Text style={styles.mockHint}>
          Sample schedule for development. Live data will replace this later.
        </Text>
      </View>

      <View style={styles.dateNav}>
        <Pressable
          style={({ pressed }) => [styles.dateButton, pressed && styles.dateButtonPressed]}
          onPress={() => setSelectedDate((d) => shiftScheduleDate(d, -1))}>
          <Text style={styles.dateButtonText}>Previous Day</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.dateButton,
            isToday && styles.dateButtonActive,
            pressed && styles.dateButtonPressed,
          ]}
          onPress={() => setSelectedDate(MOCK_SCHEDULE_TODAY)}>
          <Text style={[styles.dateButtonText, isToday && styles.dateButtonTextActive]}>
            Today
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.dateButton, pressed && styles.dateButtonPressed]}
          onPress={() => setSelectedDate((d) => shiftScheduleDate(d, 1))}>
          <Text style={styles.dateButtonText}>Next Day</Text>
        </Pressable>
      </View>

      <Text style={styles.dateHeader}>{formatScheduleDate(selectedDate)}</Text>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Conference</Text>
        <View style={styles.chipRow}>
          {MOCK_SCHEDULE_CONFERENCES.map((conf) => (
            <Pressable
              key={conf}
              style={({ pressed }) => [
                styles.chip,
                conference === conf && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setConference(conf)}>
              <Text style={[styles.chipText, conference === conf && styles.chipTextActive]}>
                {conf}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Top 25 only</Text>
        <Switch
          value={top25Only}
          onValueChange={setTop25Only}
          trackColor={{ false: colors.border, true: colors.primaryMuted }}
          thumbColor={top25Only ? colors.primary : colors.textMuted}
        />
      </View>

      <View style={styles.list}>
        {filteredGames.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No games match the current filters.</Text>
          </View>
        ) : (
          filteredGames.map((game) => <ScheduleGameCard key={game.id} game={game} />)
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mockBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  mockLabel: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mockHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dateNav: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dateButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateButtonPressed: {
    opacity: 0.85,
  },
  dateButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  dateButtonTextActive: {
    color: colors.background,
  },
  dateHeader: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  filters: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  filterLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text,
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
