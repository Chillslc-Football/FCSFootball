import { StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/TeamLogo';
import { FavoriteStar } from '@/components/FavoriteStar';
import { TeamNameLink } from '@/components/TeamNameLink';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { colors, LAYOUT_COLUMNS, POLL_RANK_COLUMN_WIDTH, spacing, typography } from '@/theme';
import type { GameLocation, NextGame, PollMovement, RankedTeam, TeamRecord } from '@/types';

type Top25TeamCardProps = {
  item: RankedTeam;
  logoUrl?: string;
  espnTeamId?: string;
  /** ESPN abbreviation when resolved; prefer over poll-synthesized abbreviations. */
  abbreviation?: string;
};

const LOCATION_LABEL: Record<GameLocation, string> = {
  home: 'Home',
  away: 'Away',
  neutral: 'Neutral',
};

function formatRecord({ wins, losses }: TeamRecord): string {
  return `${wins}-${losses}`;
}

function formatOpponent({ opponent, location }: NextGame): string {
  if (location === 'away') return `@ ${opponent}`;
  return `vs ${opponent}`;
}

function MovementBadge({ movement }: { movement?: PollMovement }) {
  if (movement === null || movement === undefined) {
    return (
      <View style={[styles.movementBadge, styles.movementNew]}>
        <Text style={[styles.movementText, styles.movementNewText]} numberOfLines={1}>
          NEW
        </Text>
      </View>
    );
  }

  if (movement === 0) {
    return (
      <View style={[styles.movementBadge, styles.movementFlat]}>
        <Text style={[styles.movementText, styles.movementFlatText]} numberOfLines={1}>
          —
        </Text>
      </View>
    );
  }

  const isUp = movement > 0;
  return (
    <View style={[styles.movementBadge, isUp ? styles.movementUp : styles.movementDown]}>
      <Text
        style={[styles.movementText, isUp ? styles.movementUpText : styles.movementDownText]}
        numberOfLines={1}>
        {isUp ? `▲ ${movement}` : `▼ ${Math.abs(movement)}`}
      </Text>
    </View>
  );
}

function NextGameSection({ nextGame }: { nextGame: NextGame }) {
  return (
    <View style={styles.nextGame}>
      <View style={styles.nextGameHeader}>
        <Text style={styles.nextGameLabel}>NEXT</Text>
        <Text style={styles.nextGameOpponent} numberOfLines={1}>
          {formatOpponent(nextGame)}
        </Text>
      </View>
      <View style={styles.nextGameMeta}>
        <Text style={styles.nextGameDetails} numberOfLines={1}>
          {nextGame.date} · {nextGame.time} · {LOCATION_LABEL[nextGame.location]}
        </Text>
        <View style={styles.broadcastBadge}>
          <Text style={styles.broadcastText}>{nextGame.broadcast}</Text>
        </View>
      </View>
    </View>
  );
}

export function Top25TeamCard({
  item,
  logoUrl,
  espnTeamId,
  abbreviation,
}: Top25TeamCardProps) {
  const { isFavorite } = useFavoriteTeams();
  const { rank, team, record, pollPoints, movement, nextGame } = item;
  const resolvedLogoUrl = logoUrl ?? team.logoUrl;
  // Prefer ESPN abbreviation from logo lookup; omit synthetic poll abbrs for matching.
  const resolvedAbbreviation = abbreviation;
  const resolvedTeamId = espnTeamId ?? team.id;
  const favorited = isFavorite(espnTeamId ?? undefined, team.name, resolvedAbbreviation);

  return (
    <View style={styles.card}>
      <View style={styles.mainRow}>
        <Text style={styles.rank} numberOfLines={1}>
          {rank}
        </Text>
        <TeamLogo
          name={team.name}
          abbreviation={resolvedAbbreviation ?? team.abbreviation}
          logoUrl={resolvedLogoUrl}
          size="poll"
        />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <TeamNameLink
              name={team.name}
              teamId={resolvedTeamId}
              style={styles.teamName}
              numberOfLines={1}
            />
            <FavoriteStar
              teamId={espnTeamId ?? undefined}
              teamName={team.name}
              abbreviation={resolvedAbbreviation}
              logoUrl={resolvedLogoUrl}
              isFavorite={favorited}
            />
          </View>
          <Text style={styles.record} numberOfLines={1}>
            {formatRecord(record)}
          </Text>
        </View>
        <View style={styles.trailing}>
          {pollPoints !== undefined ? (
            <Text style={styles.points} numberOfLines={1}>
              {pollPoints.toLocaleString()} pts
            </Text>
          ) : null}
          <MovementBadge movement={movement} />
        </View>
      </View>

      {nextGame ? (
        <>
          <View style={styles.divider} />
          <NextGameSection nextGame={nextGame} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  rank: {
    ...typography.heading,
    color: colors.primary,
    width: POLL_RANK_COLUMN_WIDTH,
    minWidth: POLL_RANK_COLUMN_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'center',
    lineHeight: 24,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
    marginBottom: 2,
  },
  teamName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  record: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: LAYOUT_COLUMNS.pollTrailingMin,
  },
  points: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    marginLeft: POLL_RANK_COLUMN_WIDTH + spacing.sm,
  },
  nextGame: {
    marginLeft: POLL_RANK_COLUMN_WIDTH + spacing.sm,
    gap: spacing.xs,
  },
  nextGameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nextGameLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 10,
  },
  nextGameOpponent: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  nextGameMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nextGameDetails: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
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
  movementBadge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 44,
    alignItems: 'center',
    flexShrink: 0,
  },
  movementText: {
    ...typography.label,
    fontSize: 10,
  },
  movementUp: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  movementUpText: {
    color: colors.success,
  },
  movementDown: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  movementDownText: {
    color: colors.error,
  },
  movementFlat: {
    backgroundColor: colors.surfaceElevated,
  },
  movementFlatText: {
    color: colors.textMuted,
  },
  movementNew: {
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
  },
  movementNewText: {
    color: colors.primary,
  },
});
