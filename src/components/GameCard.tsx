import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import { TeamNameLink } from '@/components/TeamNameLink';
import { formatGameStatusDetail } from '@/utils/formatGameTime';
import type { GameStatus, ScoreboardGame, ScoreboardTeam } from '@/types';

type GameCardProps = {
  game: ScoreboardGame;
};

const STATUS_LABEL: Record<GameStatus, string> = {
  live: 'LIVE',
  upcoming: 'UPCOMING',
  final: 'FINAL',
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankBadgeText}>#{rank}</Text>
    </View>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  showScore,
}: {
  team: ScoreboardTeam;
  score?: number;
  isWinner?: boolean;
  showScore: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      <View style={styles.teamLeft}>
        {team.rank ? <RankBadge rank={team.rank} /> : null}
        <TeamNameLink
          name={team.fullName ?? team.name}
          label={team.name}
          teamId={team.id}
          record={team.record}
          emphasized={isWinner}
        />
      </View>
      {showScore ? (
        <Text style={[styles.score, isWinner && styles.scoreWinner]}>
          {score ?? '—'}
        </Text>
      ) : null}
    </View>
  );
}

export function GameCard({ game }: GameCardProps) {
  const { awayTeam, homeTeam, status, awayScore, homeScore, statusDetail, broadcast, startTime } =
    game;
  const showScore = status === 'live' || status === 'final';
  const awayWinner = status === 'final' && awayScore !== undefined && homeScore !== undefined && awayScore > homeScore;
  const homeWinner = status === 'final' && awayScore !== undefined && homeScore !== undefined && homeScore > awayScore;
  const displayStatusDetail = formatGameStatusDetail({
    startTime,
    status,
    espnStatus: statusDetail,
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusBadge, styles[`status_${status}`]]}>
          <Text style={[styles.statusText, styles[`statusText_${status}`]]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
        <Text style={styles.statusDetail}>{displayStatusDetail}</Text>
      </View>

      <TeamRow
        team={awayTeam}
        score={awayScore}
        isWinner={awayWinner}
        showScore={showScore}
      />
      <TeamRow
        team={homeTeam}
        score={homeScore}
        isWinner={homeWinner}
        showScore={showScore}
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
    color: colors.textSecondary,
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
    color: colors.onPrimary,
    fontSize: 9,
  },
  teamName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  teamNameWinner: {
    fontWeight: '700',
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
