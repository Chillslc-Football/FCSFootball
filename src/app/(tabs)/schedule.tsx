import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { RankMergeDiagnostics } from '@/components/RankMergeDiagnostics';
import { ConferenceDropdown } from '@/components/ConferenceDropdown';
import { ScheduleGameCard } from '@/components/ScheduleGameCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { espnScoresProvider } from '@/data/providers/espnProvider';
import { groupScheduleGamesByDate } from '@/data/providers/espnScheduleMapper';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import type { RankingMergeResult } from '@/data/providers/rankingMerge';
import { SCHEDULE_WEEK_OPTIONS } from '@/data/providers/espnScheduleWeek';
import {
  DEFAULT_CONFERENCE_ID,
  getConferenceLabel,
  type ConferenceId,
} from '@/data/conferences/conferenceList';
import { colors, spacing, typography } from '@/theme';
import type { ScheduleWeekId } from '@/types';

type LoadState = 'loading' | 'success' | 'error';
type ConferencesView = 'schedule' | 'standings';

const VIEW_OPTIONS: { id: ConferencesView; label: string }[] = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'standings', label: 'Standings' },
];

export default function ConferencesScreen() {
  const [selectedConference, setSelectedConference] = useState<ConferenceId>(DEFAULT_CONFERENCE_ID);
  const [activeView, setActiveView] = useState<ConferencesView>('schedule');
  const [selectedWeek, setSelectedWeek] = useState<ScheduleWeekId>('week-1');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [fetchNotes, setFetchNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gameCount, setGameCount] = useState(0);

  const [groups, setGroups] = useState<ReturnType<typeof groupScheduleGamesByDate>>([]);
  const [mergeResult, setMergeResult] = useState<RankingMergeResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeekGames() {
      setLoadState('loading');
      setErrorMessage(null);
      setGroups([]);

      try {
        const response = await espnScoresProvider.getWeekGames(selectedWeek);
        if (cancelled) return;

        const merged = await mergeStaticRankingsOntoGames(response.data.games);
        if (cancelled) return;

        const grouped = groupScheduleGamesByDate(merged.games);
        setGroups(grouped);
        registerEspnGames(merged.games);
        setMergeResult(merged);
        setGameCount(merged.games.length);
        setFetchNotes(response.data.fetchNotes);
        setLoadState('success');
      } catch (err) {
        if (cancelled) return;
        setGroups([]);
        setGameCount(0);
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load FCS schedule from ESPN.',
        );
        setLoadState('error');
      }
    }

    void loadWeekGames();

    return () => {
      cancelled = true;
    };
  }, [selectedWeek]);

  const weekLabel =
    SCHEDULE_WEEK_OPTIONS.find((option) => option.id === selectedWeek)?.label ?? selectedWeek;

  return (
    <Screen
      title="Conferences"
      subtitle="Conference schedules, standings, and team pages — starting with the Big Sky.">
      <View style={styles.controls}>
        <ConferenceDropdown selected={selectedConference} onSelect={setSelectedConference} />

        <SegmentedControl
          options={VIEW_OPTIONS}
          selected={activeView}
          onSelect={setActiveView}
          accessibilityLabel="Conference content"
        />
      </View>

      {activeView === 'standings' ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>{getConferenceLabel(selectedConference)}</Text>
          <Text style={styles.placeholderText}>Conference standings coming soon.</Text>
        </View>
      ) : (
        <>
          <View style={styles.weekSelector}>
            <Text style={styles.weekSelectorLabel}>Week</Text>
            <View style={styles.chipRow}>
              {SCHEDULE_WEEK_OPTIONS.map((option) => {
                const isActive = selectedWeek === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => setSelectedWeek(option.id)}
                    style={[styles.chip, isActive && styles.chipActive]}>
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {loadState === 'loading' ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading {weekLabel} FCS games…</Text>
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
              <View style={styles.metaBanner}>
                <Text style={styles.metaTitle}>{weekLabel}</Text>
                <Text style={styles.metaText}>
                  {gameCount} FCS game{gameCount === 1 ? '' : 's'} · ESPN scoreboard
                </Text>
                {__DEV__ && fetchNotes ? (
                  <Text style={styles.metaNotes}>{fetchNotes}</Text>
                ) : null}
              </View>

              {groups.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No FCS games for {weekLabel}.</Text>
                  <Text style={styles.emptyText}>
                    Try another week or check back when the season schedule is available.
                  </Text>
                </View>
              ) : (
                <View style={styles.scheduleList}>
                  {groups.map((group) => (
                    <View key={group.date} style={styles.dateSection}>
                      <Text style={styles.dateHeader}>{group.label}</Text>
                      <View style={styles.list}>
                        {group.games.map((game) => (
                          <ScheduleGameCard key={game.id} game={game} />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {__DEV__ && mergeResult ? (
                <RankMergeDiagnostics result={mergeResult} />
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeholderTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  weekSelector: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  weekSelectorLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
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
    textAlign: 'center',
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
  metaBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  metaTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaNotes: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  scheduleList: {
    gap: spacing.lg,
  },
  dateSection: {
    gap: spacing.sm,
  },
  dateHeader: {
    ...typography.heading,
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
