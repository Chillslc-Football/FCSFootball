import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CompactWatchLabel } from '@/components/CompactWatchLabel';
import { GameAlertBell } from '@/components/GameAlertBell';
import { FavoriteStar } from '@/components/FavoriteStar';
import { TeamLogo } from '@/components/TeamLogo';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { openWatchOnEspn, resolveEspnWatchTargets } from '@/data/providers/espnWatchLinks';
import { resolveEspnGameStatusPresentation } from '@/data/providers/espnGameStatus';
import { formatEspnGameSituationLine } from '@/data/providers/espnGameSituation';
import { toGameStatus } from '@/data/providers/espnTodayMapper';
import { colors, LAYOUT_COLUMNS, spacing } from '@/theme';
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
  favoriteTeamId?: string;
  favoriteTeamName: string;
  isFavorite: boolean;
  favoriteAbbreviation?: string;
  favoriteLogoUrl?: string;
  favoriteConference?: string;
  favoriteRank?: number;
  favoriteRecord?: string;
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
  favoriteTeamId,
  favoriteTeamName,
  isFavorite,
  favoriteAbbreviation,
  favoriteLogoUrl,
  favoriteConference,
  favoriteRank,
  favoriteRecord,
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
      <FavoriteStar
        teamId={favoriteTeamId}
        teamName={favoriteTeamName}
        isFavorite={isFavorite}
        abbreviation={favoriteAbbreviation}
        logoUrl={favoriteLogoUrl}
        conference={favoriteConference}
        rank={favoriteRank}
        record={favoriteRecord}
      />
      {rightValue ? (
        rightTappable && onRightPress ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open ESPN Gamecast"
            hitSlop={4}
            onPress={onRightPress}
            style={({ pressed }) => [styles.rightColTap, pressed && styles.rightColTapPressed]}>
            <Text style={[styles.rightCol, isWinner && styles.rightColWinner]} numberOfLines={1}>
              {rightValue}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.rightCol, isWinner && styles.rightColWinner]} numberOfLines={1}>
            {rightValue}
          </Text>
        )
      ) : null}
    </View>
  );
}

export function ScoresGameCard({ game, isLast = false }: ScoresGameCardProps) {
  const { isFavorite: lookupFavorite } = useFavoriteTeams();
  const awayIsFavorite = lookupFavorite(game.awayTeamId, game.awayTeam, game.awayAbbreviation);
  const homeIsFavorite = lookupFavorite(game.homeTeamId, game.homeTeam, game.homeAbbreviation);

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

  const kickoffLabel = formatGameKickoffTime(game);
  const statusPresentation = resolveEspnGameStatusPresentation(game);
  const situationLine = formatEspnGameSituationLine(game);

  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.leftMeta}>
        <GameAlertBell game={game} />
        {statusPresentation.kind === 'live' ? (
          <Text style={[styles.leftMetaText, styles.leftMetaLive]} numberOfLines={2}>
            {statusPresentation.label}
          </Text>
        ) : statusPresentation.kind === 'final' || statusPresentation.kind === 'special' ? (
          <Text style={styles.leftMetaText}>{statusPresentation.label}</Text>
        ) : (
          <Text style={styles.leftMetaText}>{kickoffLabel}</Text>
        )}
      </View>

      <View style={styles.matchup}>
        <TeamLine
          key={game.awayTeamId ?? `away-${game.awayTeam}`}
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
          favoriteTeamId={game.awayTeamId}
          favoriteTeamName={game.awayTeam}
          isFavorite={awayIsFavorite}
          favoriteAbbreviation={game.awayAbbreviation}
          favoriteLogoUrl={game.awayLogoUrl}
          favoriteConference={game.awayConference}
          favoriteRank={awayRank}
          favoriteRecord={game.awayRecord}
        />
        <TeamLine
          key={game.homeTeamId ?? `home-${game.homeTeam}`}
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
          favoriteTeamId={game.homeTeamId}
          favoriteTeamName={game.homeTeam}
          isFavorite={homeIsFavorite}
          favoriteAbbreviation={game.homeAbbreviation}
          favoriteLogoUrl={game.homeLogoUrl}
          favoriteConference={game.homeConference}
          favoriteRank={homeRank}
          favoriteRecord={game.homeRecord}
        />
        {situationLine ? (
          <Text style={styles.situationText} numberOfLines={1}>
            {situationLine}
          </Text>
        ) : null}
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
    alignItems: 'flex-start',
    gap: 2,
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
  situationText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
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
    width: LAYOUT_COLUMNS.scoreValue,
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
    width: LAYOUT_COLUMNS.scoreValue,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  rightColTapPressed: {
    opacity: 0.7,
  },
});
