import { StyleSheet, Text, View } from 'react-native';

import { formatKickoffTime, toGameStatus } from '@/data/providers/espnTodayMapper';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame, GameStatus } from '@/types';

type TodayGameCardProps = {
  game: EspnNormalizedGame;
};

const STATUS_LABEL: Record<GameStatus, string> = {
  live: 'LIVE',
  upcoming: 'UPCOMING',
  final: 'FINAL',
};

function TeamRow({
  name,
  score,
  isWinner,
  showScore,
}: {
  name: string;
  score?: number;
  isWinner?: boolean;
  showScore: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      <Text style={[styles.teamName, isWinner && styles.teamNameWinner]} numberOfLines={1}>
        {name}
      </Text>
      {showScore ? (
        <Text style={[styles.score, isWinner && styles.scoreWinner]}>
          {score ?? '—'}
        </Text>
      ) : null}
    </View>
  );
}

export function TodayGameCard({ game }: TodayGameCardProps) {
  const status = toGameStatus(game);
  const showScore = status === 'live' || status === 'final';
  const awayWinner =
    status === 'final' &&
    game.awayScore != null &&
    game.homeScore != null &&
    game.awayScore > game.homeScore;
  const homeWinner =
    status === 'final' &&
    game.awayScore != null &&
    game.homeScore != null &&
    game.homeScore > game.awayScore;
  const kickoff = formatKickoffTime(game.startTime);
  const statusDetail = status === 'upcoming' ? kickoff : game.status;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusBadge, styles[`status_${status}`]]}>
          <Text style={[styles.statusText, styles[`statusText_${status}`]]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
        <Text style={styles.statusDetail}>{statusDetail}</Text>
      </View>

      <TeamRow
        name={game.awayTeam}
        score={game.awayScore}
        isWinner={awayWinner}
        showScore={showScore}
      />
      <Text style={styles.atLabel}>at</Text>
      <TeamRow
        name={game.homeTeam}
        score={game.homeScore}
        isWinner={homeWinner}
        showScore={showScore}
      />

      <View style={styles.metaRow}>
        {game.venue ? (
          <Text style={styles.venueText} numberOfLines={2}>
            {game.venue}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.broadcastBadge}>
          <Text style={styles.broadcastText}>{game.broadcast ?? '—'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  status_live: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  status_upcoming: {
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
  },
  status_final: {
    backgroundColor: colors.surfaceElevated,
  },
  statusText: {
    ...typography.label,
    fontSize: 10,
  },
  statusText_live: {
    color: colors.error,
  },
  statusText_upcoming: {
    color: colors.primary,
  },
  statusText_final: {
    color: colors.textMuted,
  },
  statusDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  teamName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  teamNameWinner: {
    fontWeight: '700',
  },
  atLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  score: {
    ...typography.heading,
    fontSize: 18,
    color: colors.textSecondary,
    minWidth: 32,
    textAlign: 'right',
  },
  scoreWinner: {
    color: colors.text,
  },
  metaRow: {
    marginTop: spacing.xs,
  },
  venueText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  broadcastBadge: {
    backgroundColor: colors.surfaceElevated,
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
