import { StyleSheet, Text, View } from 'react-native';

import { WatchOnEspnButton } from '@/components/WatchOnEspnButton';
import { GameCardDevDiagnostics } from '@/components/GameCardDevDiagnostics';
import { TeamLogo } from '@/components/TeamLogo';
import { TeamNameLink } from '@/components/TeamNameLink';
import { isFcsFbsEspnGame } from '@/data/scores/scoresFilters';
import { formatEspnGameSituationLine } from '@/data/providers/espnGameSituation';
import { toGameStatus } from '@/data/providers/espnTodayMapper';
import { colors, spacing, typography } from '@/theme';
import { formatGameStatusDetail } from '@/utils/formatGameTime';
import { getAwayCompactName, getHomeCompactName } from '@/utils/teamDisplay';
import type { EspnNormalizedGame, GameStatus } from '@/types';

type TodayGameCardProps = {
  game: EspnNormalizedGame;
  onWatchOpened?: (result: { gameId: string; openedUrl?: string }) => void;
  showDevDiagnostics?: boolean;
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
  name,
  compactName,
  teamId,
  abbreviation,
  logoUrl,
  rank,
  record,
  score,
  isWinner,
  showScore,
}: {
  name: string;
  compactName: string;
  teamId?: string;
  abbreviation?: string;
  logoUrl?: string;
  rank?: number;
  record?: string;
  score?: number;
  isWinner?: boolean;
  showScore: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      <View style={styles.teamLeft}>
        <TeamLogo name={name} abbreviation={abbreviation} logoUrl={logoUrl} size="list" />
        {rank != null ? <RankBadge rank={rank} /> : null}
        <TeamNameLink
          name={name}
          label={compactName}
          teamId={teamId}
          record={record}
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

export function TodayGameCard({ game, onWatchOpened, showDevDiagnostics }: TodayGameCardProps) {
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
  const statusDetail = formatGameStatusDetail({
    startTime: game.startTime,
    status,
    espnStatus: game.status,
    normalizedStatus: game.normalizedStatus,
  });
  const situationLine = formatEspnGameSituationLine(game);
  const showFbsBadge = isFcsFbsEspnGame(game);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusBadge, styles[`status_${status}`]]}>
            <Text style={[styles.statusText, styles[`statusText_${status}`]]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
          {showFbsBadge ? (
            <View style={styles.fbsBadge}>
              <Text style={styles.fbsBadgeText}>FCS vs FBS</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.statusDetail}>{statusDetail}</Text>
      </View>

      <TeamRow
        name={game.awayTeam}
        compactName={getAwayCompactName(game)}
        teamId={game.awayTeamId}
        abbreviation={game.awayAbbreviation}
        logoUrl={game.awayLogoUrl}
        rank={game.awayIsRanked ? game.awayRank : undefined}
        record={game.awayRecord}
        score={game.awayScore}
        isWinner={awayWinner}
        showScore={showScore}
      />
      <Text style={styles.atLabel}>at</Text>
      <TeamRow
        name={game.homeTeam}
        compactName={getHomeCompactName(game)}
        teamId={game.homeTeamId}
        abbreviation={game.homeAbbreviation}
        logoUrl={game.homeLogoUrl}
        rank={game.homeIsRanked ? game.homeRank : undefined}
        record={game.homeRecord}
        score={game.homeScore}
        isWinner={homeWinner}
        showScore={showScore}
      />

      {situationLine ? (
        <Text style={styles.situationText} numberOfLines={1}>
          {situationLine}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {game.venue ? (
          <Text style={styles.venueText} numberOfLines={2}>
            {game.venue}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <WatchOnEspnButton game={game} onOpened={onWatchOpened} />
      </View>

      {showDevDiagnostics && __DEV__ ? <GameCardDevDiagnostics game={game} /> : null}
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
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
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
  atLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  situationText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
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
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});
