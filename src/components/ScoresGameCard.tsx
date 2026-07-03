import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TeamLogo } from '@/components/TeamLogo';
import { openWatchOnEspn, resolveEspnWatchTargets } from '@/data/providers/espnWatchLinks';
import { toGameStatus } from '@/data/providers/espnTodayMapper';
import { colors, spacing, typography } from '@/theme';
import { formatGameKickoffTime } from '@/utils/formatGameTime';
import { buildTeamHref } from '@/utils/teamId';
import type { EspnNormalizedGame } from '@/types';

type ScoresGameCardProps = {
  game: EspnNormalizedGame;
  isLast?: boolean;
};

type TeamLineProps = {
  logoName: string;
  abbreviation?: string;
  logoUrl?: string;
  rank?: number;
  teamName: string;
  /** Full team name for navigation — same as Conference tab `name` prop */
  navigationName: string;
  teamId?: string;
  rightValue?: string;
  isWinner?: boolean;
  onRightPress?: () => void;
  rightTappable?: boolean;
};

function TeamLine({
  logoName,
  abbreviation,
  logoUrl,
  rank,
  teamName,
  navigationName,
  teamId,
  rightValue,
  isWinner,
  onRightPress,
  rightTappable = false,
}: TeamLineProps) {
  const router = useRouter();

  return (
    <View style={styles.teamLine}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`View ${navigationName} team page`}
        onPress={() => router.push(buildTeamHref({ teamId, name: navigationName }))}
        style={({ pressed }) => [styles.teamTapArea, pressed && styles.teamTapAreaPressed]}>
        <TeamLogo name={logoName} abbreviation={abbreviation} logoUrl={logoUrl} size={22} />
        <Text style={[styles.teamName, isWinner && styles.teamNameWinner]} numberOfLines={1}>
          {rank != null ? `${rank} ${teamName}` : teamName}
        </Text>
      </Pressable>
      {rightValue ? (
        rightTappable && onRightPress ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Watch on ESPN"
            hitSlop={4}
            onPress={onRightPress}
            style={({ pressed }) => [styles.rightColTap, pressed && styles.rightColTapPressed]}>
            <Text style={[styles.rightCol, isWinner && styles.rightColWinner]}>{rightValue}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.rightCol, isWinner && styles.rightColWinner]}>{rightValue}</Text>
        )
      ) : null}
    </View>
  );
}

function CompactWatchLabel({ game }: { game: EspnNormalizedGame }) {
  const resolution = useMemo(() => resolveEspnWatchTargets(game), [game]);
  const [opening, setOpening] = useState(false);
  const broadcast = game.broadcast?.trim();
  const label = broadcast || (resolution.enabled ? 'Watch on ESPN' : '');

  if (!label) return null;

  async function handlePress() {
    if (!resolution.enabled || opening) return;
    setOpening(true);
    try {
      await openWatchOnEspn(game);
    } finally {
      setOpening(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !resolution.enabled }}
      disabled={!resolution.enabled || opening}
      onPress={() => void handlePress()}
      style={({ pressed }) => [styles.watchLabel, pressed && resolution.enabled && styles.watchLabelPressed]}>
      {opening ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Text style={[styles.watchLabelText, !resolution.enabled && styles.watchLabelDisabled]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ScoresGameCard({ game, isLast = false }: ScoresGameCardProps) {
  const status = toGameStatus(game);
  const showScore = status === 'live' || status === 'final';
  const watchResolution = useMemo(() => resolveEspnWatchTargets(game), [game]);
  const canOpenWatch = watchResolution.enabled;

  const openWatch = useCallback(() => {
    if (!canOpenWatch) return;
    void openWatchOnEspn(game);
  }, [canOpenWatch, game]);

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

  const awayName = game.awayShortDisplayName ?? game.awayTeam;
  const homeName = game.homeShortDisplayName ?? game.homeTeam;
  const awayRank = game.awayIsRanked ? game.awayRank : undefined;
  const homeRank = game.homeIsRanked ? game.homeRank : undefined;

  const awayRight = showScore
    ? String(game.awayScore ?? '—')
    : game.awayRecord?.trim() || undefined;
  const homeRight = showScore
    ? String(game.homeScore ?? '—')
    : game.homeRecord?.trim() || undefined;

  const kickoffLabel = formatGameKickoffTime(game.startTime);
  const isInProgress = game.normalizedStatus === 'in_progress';
  const isFinal = game.normalizedStatus === 'final';

  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.leftMeta}>
        {isInProgress ? (
          <Text style={[styles.leftMetaText, styles.leftMetaLive]} numberOfLines={2}>
            {game.status}
          </Text>
        ) : isFinal ? (
          <Text style={styles.leftMetaText}>Final</Text>
        ) : (
          <Text style={styles.leftMetaText}>{kickoffLabel}</Text>
        )}
      </View>

      <View style={styles.matchup}>
        <TeamLine
          logoName={game.awayTeam}
          abbreviation={game.awayAbbreviation}
          logoUrl={game.awayLogoUrl}
          rank={awayRank}
          teamName={awayName}
          navigationName={game.awayTeam}
          teamId={game.awayTeamId}
          rightValue={awayRight}
          isWinner={awayWinner}
          onRightPress={openWatch}
          rightTappable={showScore && canOpenWatch}
        />
        <TeamLine
          logoName={game.homeTeam}
          abbreviation={game.homeAbbreviation}
          logoUrl={game.homeLogoUrl}
          rank={homeRank}
          teamName={homeName}
          navigationName={game.homeTeam}
          teamId={game.homeTeamId}
          rightValue={homeRight}
          isWinner={homeWinner}
          onRightPress={openWatch}
          rightTappable={showScore && canOpenWatch}
        />
        <CompactWatchLabel game={game} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leftMeta: {
    width: 52,
    paddingTop: 2,
    flexShrink: 0,
  },
  leftMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 16,
  },
  leftMetaLive: {
    color: colors.error,
  },
  matchup: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  teamLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  teamTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  teamTapAreaPressed: {
    opacity: 0.7,
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 18,
    minWidth: 0,
  },
  teamNameWinner: {
    fontWeight: '700',
  },
  rightCol: {
    width: 36,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  rightColWinner: {
    color: colors.text,
    fontWeight: '700',
  },
  rightColTap: {
    width: 36,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  rightColTapPressed: {
    opacity: 0.7,
  },
  watchLabel: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 1,
  },
  watchLabelPressed: {
    opacity: 0.7,
  },
  watchLabelText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  watchLabelDisabled: {
    color: colors.textMuted,
  },
});
