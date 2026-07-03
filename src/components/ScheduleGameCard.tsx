import { StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/TeamLogo';
import { TeamNameLink } from '@/components/TeamNameLink';
import { colors, spacing, typography } from '@/theme';
import { formatScheduleGameKickoff } from '@/utils/formatGameTime';
import type { GameStatus, ScheduleGame, ScheduleTeam } from '@/types';

type ScheduleGameCardProps = {
  game: ScheduleGame;
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
  team: ScheduleTeam;
  score?: number;
  isWinner?: boolean;
  showScore: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      <View style={styles.teamLeft}>
        <TeamLogo
          name={team.fullName ?? team.name}
          abbreviation={team.abbreviation}
          logoUrl={team.logoUrl}
          size="list"
        />
        {team.rank ? <RankBadge rank={team.rank} /> : null}
        <TeamNameLink
          name={team.fullName ?? team.name}
          label={team.name}
          teamId={team.id}
          record={team.record}
          emphasized={isWinner}
        />
      </View>
      <View style={styles.teamRight}>
        {team.conference ? (
          <Text style={styles.teamConference} numberOfLines={1}>
            {team.conference}
          </Text>
        ) : null}
        {showScore ? (
          <Text style={[styles.score, isWinner && styles.scoreWinner]}>{score ?? '—'}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function ScheduleGameCard({ game }: ScheduleGameCardProps) {
  const isFbsMatchup = game.matchupType === 'fcs-fbs';
  const status = game.status ?? 'upcoming';
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

  const kickoffLabel = formatScheduleGameKickoff(game);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.time}>{kickoffLabel}</Text>
          {game.status ? (
            <View style={[styles.statusBadge, styles[`status_${status}`]]}>
              <Text style={[styles.statusText, styles[`statusText_${status}`]]}>
                {STATUS_LABEL[status]}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.badges}>
          {isFbsMatchup ? (
            <View style={styles.fbsBadge}>
              <Text style={styles.fbsBadgeText}>FCS vs FBS</Text>
            </View>
          ) : null}
          {game.conference ? (
            <View style={styles.confBadge}>
              <Text style={styles.confBadgeText} numberOfLines={1}>
                {game.conference}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {game.statusDetail && status !== 'upcoming' ? (
        <Text style={styles.statusDetail}>{game.statusDetail}</Text>
      ) : null}

      <TeamRow
        team={game.awayTeam}
        score={game.awayScore}
        isWinner={awayWinner}
        showScore={showScore}
      />
      <Text style={styles.atLabel}>at</Text>
      <TeamRow
        team={game.homeTeam}
        score={game.homeScore}
        isWinner={homeWinner}
        showScore={showScore}
      />

      {game.venue ? (
        <Text style={styles.venueText} numberOfLines={2}>
          {game.venue}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.broadcastBadge}>
          <Text style={styles.broadcastText}>{game.broadcast}</Text>
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
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  time: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
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
    fontSize: 9,
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
    marginBottom: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    flex: 1,
  },
  fbsBadge: {
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fbsBadgeText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 9,
  },
  confBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 120,
  },
  confBadgeText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
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
  teamRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
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
  teamNameWinner: {
    fontWeight: '700',
  },
  teamConference: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    maxWidth: 72,
  },
  score: {
    ...typography.heading,
    fontSize: 18,
    color: colors.textSecondary,
    minWidth: 28,
    textAlign: 'right',
  },
  scoreWinner: {
    color: colors.text,
    fontWeight: '700',
  },
  atLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  venueText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
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
