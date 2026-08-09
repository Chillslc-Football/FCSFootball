import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CompactWatchLabel } from '@/components/CompactWatchLabel';
import { FavoriteStar } from '@/components/FavoriteStar';
import { TeamLogo } from '@/components/TeamLogo';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { resolveEspnGameStatusPresentation } from '@/data/providers/espnGameStatus';
import { formatEspnGameSituationLine } from '@/data/providers/espnGameSituation';
import { toGameStatus } from '@/data/providers/espnTodayMapper';
import { colors, LAYOUT_COLUMNS, spacing } from '@/theme';
import { formatGameKickoffDateCompact, formatGameKickoffTime } from '@/utils/formatGameTime';
import {
  getAwayTeamScheduleCompactName,
  getHomeTeamScheduleCompactName,
} from '@/utils/teamDisplay';
import { buildTeamHref } from '@/utils/teamId';
import type { EspnNormalizedGame } from '@/types';

type TeamScheduleGameRowProps = {
  game: EspnNormalizedGame;
  isLast?: boolean;
};

type TeamLineProps = {
  logoName: string;
  abbreviation?: string;
  logoUrl?: string;
  rank?: number;
  teamName: string;
  navigationName: string;
  teamId?: string;
  rightValue?: string;
  isWinner?: boolean;
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
        <TeamLogo name={logoName} abbreviation={abbreviation} logoUrl={logoUrl} size={20} />
        <Text style={[styles.teamName, isWinner && styles.teamNameWinner]} numberOfLines={1}>
          {rank != null ? `#${rank} ${teamName}` : teamName}
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
        style={styles.favoriteStar}
      />
      {rightValue ? <Text style={[styles.rightCol, isWinner && styles.rightColWinner]}>{rightValue}</Text> : null}
    </View>
  );
}

export function TeamScheduleGameRow({ game, isLast = false }: TeamScheduleGameRowProps) {
  const { isFavorite: lookupFavorite } = useFavoriteTeams();
  const awayIsFavorite = lookupFavorite(game.awayTeamId, game.awayTeam, game.awayAbbreviation);
  const homeIsFavorite = lookupFavorite(game.homeTeamId, game.homeTeam, game.homeAbbreviation);

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

  const awayName = getAwayTeamScheduleCompactName(game);
  const homeName = getHomeTeamScheduleCompactName(game);
  const awayRank = game.awayIsRanked ? game.awayRank : undefined;
  const homeRank = game.homeIsRanked ? game.homeRank : undefined;

  const awayRight = showScore
    ? String(game.awayScore ?? '—')
    : game.awayRecord?.trim() || undefined;
  const homeRight = showScore
    ? String(game.homeScore ?? '—')
    : game.homeRecord?.trim() || undefined;

  const dateLabel = formatGameKickoffDateCompact(game);
  const kickoffLabel = formatGameKickoffTime(game);
  const statusPresentation = resolveEspnGameStatusPresentation(game);
  const situationLine = formatEspnGameSituationLine(game);

  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
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
      </View>

      <View style={styles.rightMeta}>
        <Text style={styles.dateText} numberOfLines={1}>
          {dateLabel}
        </Text>
        {statusPresentation.kind === 'live' ? (
          <Text style={[styles.timeText, styles.timeTextLive]} numberOfLines={2}>
            {statusPresentation.label}
          </Text>
        ) : statusPresentation.kind === 'final' || statusPresentation.kind === 'special' ? (
          <Text style={styles.timeText} numberOfLines={2}>
            {statusPresentation.label}
          </Text>
        ) : (
          <Text style={styles.timeText} numberOfLines={1}>
            {kickoffLabel}
          </Text>
        )}
        <CompactWatchLabel game={game} align="end" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  matchup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  situationText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 14,
  },
  rightMeta: {
    // Compact dates (Sep 13) + time + network — keep fixed so names get remaining width.
    width: LAYOUT_COLUMNS.scheduleMeta,
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 15,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 14,
  },
  timeTextLive: {
    color: colors.error,
  },
  teamLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 0,
    minHeight: 22,
  },
  teamTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    minHeight: 22,
  },
  teamTapAreaPressed: {
    opacity: 0.7,
  },
  favoriteStar: {
    padding: 0,
  },
  teamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 16,
    minWidth: 0,
  },
  teamNameWinner: {
    fontWeight: '700',
  },
  rightCol: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  rightColWinner: {
    color: colors.text,
    fontWeight: '700',
  },
});
