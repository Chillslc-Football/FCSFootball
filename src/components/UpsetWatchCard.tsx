import { StyleSheet, Text, View } from 'react-native';

import { WatchOnEspnButton } from '@/components/WatchOnEspnButton';
import { TeamLogo } from '@/components/TeamLogo';
import { TeamNameLink } from '@/components/TeamNameLink';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame, UpsetAlertLabel, UpsetWatchGame } from '@/types';

type UpsetWatchCardProps = {
  game: UpsetWatchGame;
  watchGame?: EspnNormalizedGame;
  onWatchOpened?: (result: { gameId: string; openedUrl?: string }) => void;
};

const ALERT_STYLE: Record<
  UpsetAlertLabel,
  { background: string; border: string; text: string }
> = {
  'Upset Alert': {
    background: 'rgba(239, 68, 68, 0.15)',
    border: colors.error,
    text: colors.error,
  },
  'One Score Game': {
    background: 'rgba(201, 162, 39, 0.15)',
    border: colors.primary,
    text: colors.primary,
  },
  'FCS Leading': {
    background: 'rgba(34, 197, 94, 0.15)',
    border: colors.success,
    text: colors.success,
  },
  'FCS Win': {
    background: 'rgba(201, 162, 39, 0.2)',
    border: colors.primaryMuted,
    text: colors.primary,
  },
};

function TeamScoreRow({
  name,
  compactName,
  teamId,
  abbreviation,
  logoUrl,
  record,
  score,
  isFcs,
  isWinner,
}: {
  name: string;
  compactName: string;
  teamId: string;
  abbreviation?: string;
  logoUrl?: string;
  record?: string;
  score: number;
  isFcs: boolean;
  isWinner: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      <View style={styles.teamLeft}>
        <TeamLogo name={name} abbreviation={abbreviation} logoUrl={logoUrl} size="list" />
        {isFcs ? (
          <View style={styles.fcsBadge}>
            <Text style={styles.fcsBadgeText}>FCS</Text>
          </View>
        ) : (
          <View style={styles.fbsBadge}>
            <Text style={styles.fbsBadgeText}>FBS</Text>
          </View>
        )}
        <TeamNameLink
          name={name}
          label={compactName}
          teamId={teamId}
          record={record}
          emphasized={isWinner}
        />
      </View>
      <Text style={[styles.score, isWinner && styles.scoreWinner]}>{score}</Text>
    </View>
  );
}

export function UpsetWatchCard({ game, watchGame, onWatchOpened }: UpsetWatchCardProps) {
  const { fcsTeam, fbsTeam, fcsScore, fbsScore, status, statusDetail, alertLabel, broadcast } =
    game;
  const alertStyle = ALERT_STYLE[alertLabel];
  const fcsWinner = fcsScore > fbsScore;
  const fbsWinner = fbsScore > fcsScore;

  return (
    <View style={[styles.card, { borderColor: alertStyle.border }]}>
      <View style={styles.header}>
        <View style={[styles.alertBadge, { backgroundColor: alertStyle.background }]}>
          <Text style={[styles.alertText, { color: alertStyle.text }]}>{alertLabel}</Text>
        </View>
        <Text style={styles.statusDetail}>
          {status === 'live' ? `LIVE · ${statusDetail}` : statusDetail}
        </Text>
      </View>

      <TeamScoreRow
        name={fcsTeam.fullName ?? fcsTeam.name}
        compactName={fcsTeam.name}
        teamId={fcsTeam.id}
        abbreviation={fcsTeam.abbreviation}
        logoUrl={fcsTeam.logoUrl}
        record={fcsTeam.record}
        score={fcsScore}
        isFcs
        isWinner={fcsWinner}
      />
      <TeamScoreRow
        name={fbsTeam.fullName ?? fbsTeam.name}
        compactName={fbsTeam.name}
        teamId={fbsTeam.id}
        abbreviation={fbsTeam.abbreviation}
        logoUrl={fbsTeam.logoUrl}
        record={fbsTeam.record}
        score={fbsScore}
        isFcs={false}
        isWinner={fbsWinner}
      />

      <View style={styles.footer}>
        <View style={styles.broadcastBadge}>
          <Text style={styles.broadcastText}>{broadcast}</Text>
        </View>
        {watchGame ? (
          <WatchOnEspnButton game={watchGame} onOpened={onWatchOpened} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  alertBadge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  alertText: {
    ...typography.label,
    fontSize: 10,
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
  fcsBadge: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fcsBadgeText: {
    ...typography.label,
    color: colors.background,
    fontSize: 8,
  },
  fbsBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fbsBadgeText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 8,
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
    fontSize: 20,
    color: colors.textSecondary,
    minWidth: 32,
    textAlign: 'right',
  },
  scoreWinner: {
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
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
