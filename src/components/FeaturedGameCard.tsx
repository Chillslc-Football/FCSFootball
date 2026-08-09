import { StyleSheet, Text, View } from 'react-native';

import { WatchOnEspnButton } from '@/components/WatchOnEspnButton';
import { TeamLogo } from '@/components/TeamLogo';
import { TeamNameLink } from '@/components/TeamNameLink';
import { colors, spacing, typography } from '@/theme';
import { formatGameStatusDetail } from '@/utils/formatGameTime';
import type { EspnNormalizedGame, GameStatus, ScoreboardGame, ScoreboardTeam } from '@/types';

type FeaturedGameCardProps = {
  game: ScoreboardGame;
  highlightTeamId?: string;
  watchGame?: EspnNormalizedGame;
  onWatchOpened?: (result: { gameId: string; openedUrl?: string }) => void;
};

const STATUS_LABEL: Record<GameStatus, string> = {
  live: 'LIVE',
  upcoming: 'UPCOMING',
  final: 'FINAL',
};

const STATUS_DETAIL_STYLE: Record<GameStatus, { badge: object; text: object }> = {
  live: {
    badge: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
    text: { color: colors.error },
  },
  upcoming: {
    badge: { backgroundColor: 'rgba(201, 162, 39, 0.15)' },
    text: { color: colors.primary },
  },
  final: {
    badge: { backgroundColor: colors.surfaceElevated },
    text: { color: colors.textSecondary },
  },
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
        <TeamLogo
          name={team.fullName ?? team.name}
          abbreviation={team.abbreviation}
          logoUrl={team.logoUrl}
          size="featured"
        />
        {team.rank ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>#{team.rank}</Text>
          </View>
        ) : null}
        <TeamNameLink
          name={team.fullName ?? team.name}
          label={team.name}
          teamId={team.id}
          record={team.record}
          emphasized={highlighted}
        />
      </View>
      {score !== undefined ? (
        <Text style={[styles.score, highlighted && styles.scoreHighlighted]}>{score}</Text>
      ) : null}
    </View>
  );
}

export function FeaturedGameCard({
  game,
  highlightTeamId,
  watchGame,
  onWatchOpened,
}: FeaturedGameCardProps) {
  const { awayTeam, homeTeam, awayScore, homeScore, status, statusDetail, startTime } =
    game;
  const statusStyle = STATUS_DETAIL_STYLE[status];
  const showScores = status === 'live' || status === 'final';
  const displayStatusDetail = formatGameStatusDetail({
    startTime,
    status,
    espnStatus: statusDetail,
  });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.featuredLabel}>Featured</Text>
        <View style={[styles.statusBadge, statusStyle.badge]}>
          <Text style={[styles.statusBadgeText, statusStyle.text]}>
            {STATUS_LABEL[status]} · {displayStatusDetail}
          </Text>
        </View>
      </View>

      <Text style={styles.matchupLabel}>
        {awayTeam.name} at {homeTeam.name}
      </Text>

      <TeamLine
        team={awayTeam}
        score={showScores ? awayScore : undefined}
        highlighted={awayTeam.id === highlightTeamId}
      />
      <Text style={styles.atLabel}>at</Text>
      <TeamLine
        team={homeTeam}
        score={showScores ? homeScore : undefined}
        highlighted={homeTeam.id === highlightTeamId}
      />

      <View style={styles.footer}>
        {watchGame ? (
          <WatchOnEspnButton game={watchGame} onOpened={onWatchOpened} />
        ) : null}
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
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusBadgeText: {
    ...typography.label,
    fontSize: 10,
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
    color: colors.onPrimary,
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
    color: colors.textSecondary,
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
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
