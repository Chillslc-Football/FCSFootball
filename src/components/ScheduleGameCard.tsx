import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import type { ScheduleGame, ScheduleTeam } from '@/types';

type ScheduleGameCardProps = {
  game: ScheduleGame;
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankBadgeText}>#{rank}</Text>
    </View>
  );
}

function TeamRow({ team }: { team: ScheduleTeam }) {
  return (
    <View style={styles.teamRow}>
      <View style={styles.teamLeft}>
        {team.rank ? <RankBadge rank={team.rank} /> : null}
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
      </View>
      {team.conference ? (
        <Text style={styles.teamConference}>{team.conference}</Text>
      ) : null}
    </View>
  );
}

export function ScheduleGameCard({ game }: ScheduleGameCardProps) {
  const isFbsMatchup = game.matchupType === 'fcs-fbs';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.time}>{game.time}</Text>
        <View style={styles.badges}>
          {isFbsMatchup ? (
            <View style={styles.fbsBadge}>
              <Text style={styles.fbsBadgeText}>FCS vs FBS</Text>
            </View>
          ) : null}
          {game.conference ? (
            <View style={styles.confBadge}>
              <Text style={styles.confBadgeText}>{game.conference}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <TeamRow team={game.awayTeam} />
      <Text style={styles.atLabel}>at</Text>
      <TeamRow team={game.homeTeam} />

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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  time: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  badges: {
    flexDirection: 'row',
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
  confBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
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
  teamConference: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  atLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
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
