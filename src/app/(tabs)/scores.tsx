import { StyleSheet, Text, View } from 'react-native';

import { GameCard } from '@/components/GameCard';
import { Screen } from '@/components/Screen';
import {
  MOCK_FINAL_GAMES,
  MOCK_LIVE_GAMES,
  MOCK_SCORES_META,
  MOCK_UPCOMING_GAMES,
} from '@/data/mock/scores';
import { colors, spacing, typography } from '@/theme';
import type { ScoreboardGame } from '@/types';

type GameSectionProps = {
  title: string;
  games: ScoreboardGame[];
};

function GameSection({ title, games }: GameSectionProps) {
  if (games.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.list}>
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </View>
    </View>
  );
}

export default function ScoresScreen() {
  return (
    <Screen title="Scores" subtitle="Live and final scores from FCS games.">
      <View style={styles.mockBanner}>
        <Text style={styles.mockLabel}>Mock Data</Text>
        <Text style={styles.mockText}>{MOCK_SCORES_META.dateLabel}</Text>
        <Text style={styles.mockHint}>
          Sample scores for development. Live data will replace this later.
        </Text>
      </View>

      <GameSection title="Live" games={MOCK_LIVE_GAMES} />
      <GameSection title="Upcoming" games={MOCK_UPCOMING_GAMES} />
      <GameSection title="Final" games={MOCK_FINAL_GAMES} />
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
    marginBottom: spacing.xs,
  },
  mockHint: {
    ...typography.caption,
    color: colors.textSecondary,
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
});
