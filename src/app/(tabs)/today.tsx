import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FeaturedGameCard } from '@/components/FeaturedGameCard';
import { Screen } from '@/components/Screen';
import { ScheduleGameCard } from '@/components/ScheduleGameCard';
import { UpsetWatchCard } from '@/components/UpsetWatchCard';
import { MOCK_LIVE_GAMES, MOCK_SCORES_META, MOCK_UPSET_WATCH_GAMES } from '@/data/mock/scores';
import { MOCK_SCHEDULE_GAMES, MOCK_SCHEDULE_TODAY } from '@/data/mock/schedule';
import { colors, spacing, typography } from '@/theme';
import type { ScheduleGame } from '@/types';

const FEATURED_GAME = MOCK_LIVE_GAMES.find((g) => g.id === 'live-1')!;
const UPSET_PREVIEW = MOCK_UPSET_WATCH_GAMES.slice(0, 2);

const todayGames = MOCK_SCHEDULE_GAMES.filter((g) => g.date === MOCK_SCHEDULE_TODAY);
const rankedGamesToday = todayGames.filter((g) => g.awayTeam.rank || g.homeTeam.rank);

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function GameList({ games }: { games: ScheduleGame[] }) {
  if (games.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No games scheduled.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {games.map((game) => (
        <ScheduleGameCard key={game.id} game={game} />
      ))}
    </View>
  );
}

export default function TodayScreen() {
  return (
    <Screen title="Today" subtitle="Your FCS football snapshot for today.">
      <View style={styles.mockBanner}>
        <Text style={styles.mockLabel}>Mock Data</Text>
        <Text style={styles.mockText}>{MOCK_SCORES_META.dateLabel}</Text>
      </View>

      <Section title="Featured">
        <FeaturedGameCard game={FEATURED_GAME} highlightTeamId="mtst" />
      </Section>

      <Section title="Upset Watch">
        <View style={styles.list}>
          {UPSET_PREVIEW.map((game) => (
            <UpsetWatchCard key={game.id} game={game} />
          ))}
        </View>
      </Section>

      <Section title="Ranked Games Today">
        <GameList games={rankedGamesToday} />
      </Section>

      <Section title="All FCS Games Today">
        <GameList games={todayGames} />
      </Section>
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
    marginBottom: spacing.lg,
  },
  mockLabel: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mockText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
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
