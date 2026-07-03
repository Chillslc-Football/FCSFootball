import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import type { ScoreboardGame, ScoreboardTeam } from '@/types';

type FeaturedGameCardProps = {
  game: ScoreboardGame;
  highlightTeamId?: string;
};

function TeamLine({
  team,
  score,
  highlighted,
}: {
  team: ScoreboardTeam;
  score?: number;
  highlighted?: boolean;
}) {
  return (
    <View style={[styles.teamRow, highlighted && styles.teamRowHighlighted]}>
      <View style={styles.teamLeft}>
        {team.rank ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>#{team.rank}</Text>
          </View>
        ) : null}
        <Text style={[styles.teamName, highlighted && styles.teamNameHighlighted]} numberOfLines={1}>
          {team.name}
        </Text>
      </View>
      {score !== undefined ? (
        <Text style={[styles.score, highlighted && styles.scoreHighlighted]}>{score}</Text>
      ) : null}
    </View>
  );
}

export function FeaturedGameCard({ game, highlightTeamId }: FeaturedGameCardProps) {
  const { awayTeam, homeTeam, awayScore, homeScore, statusDetail, broadcast } = game;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.featuredLabel}>Featured</Text>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE · {statusDetail}</Text>
        </View>
      </View>

      <Text style={styles.matchupLabel}>Brawl of the Wild</Text>

      <TeamLine
        team={awayTeam}
        score={awayScore}
        highlighted={awayTeam.id === highlightTeamId}
      />
      <Text style={styles.atLabel}>at</Text>
      <TeamLine
        team={homeTeam}
        score={homeScore}
        highlighted={homeTeam.id === highlightTeamId}
      />

      <View style={styles.footer}>
        <View style={styles.broadcastBadge}>
          <Text style={styles.broadcastText}>{broadcast}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  featuredLabel: {
    ...typography.label,
    color: colors.primary,
  },
  liveBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  liveText: {
    ...typography.label,
    color: colors.error,
    fontSize: 10,
  },
  matchupLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  teamRowHighlighted: {
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
  },
  teamLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  rankBadge: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankBadgeText: {
    ...typography.label,
    color: colors.background,
    fontSize: 9,
  },
  teamName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  teamNameHighlighted: {
    fontWeight: '700',
    color: colors.primary,
  },
  atLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  score: {
    ...typography.title,
    fontSize: 24,
    color: colors.textSecondary,
  },
  scoreHighlighted: {
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  broadcastBadge: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  broadcastText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 10,
  },
});
