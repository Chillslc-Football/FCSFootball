import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CompactWatchLabel } from '@/components/CompactWatchLabel';
import { FavoriteStar } from '@/components/FavoriteStar';
import { TeamLogo } from '@/components/TeamLogo';
import {
  enrichFavoriteTeam,
  findNextTeamGame,
} from '@/data/favorites/findNextTeamGame';
import { colors, spacing, typography } from '@/theme';
import {
  formatFavoriteUpcomingKickoff,
  formatGameKickoffDate,
} from '@/utils/formatGameTime';
import { buildTeamHref } from '@/utils/teamId';
import type { EspnNormalizedGame } from '@/types';
import type { FavoriteTeam } from '@/types/favorites';

type FavoriteTeamRowProps = {
  favorite: FavoriteTeam;
  allGames: EspnNormalizedGame[];
  isLast?: boolean;
};

export function FavoriteTeamRow({ favorite, allGames, isLast = false }: FavoriteTeamRowProps) {
  const router = useRouter();

  let enriched = favorite;
  let nextGameInfo: ReturnType<typeof findNextTeamGame> = null;

  try {
    enriched = enrichFavoriteTeam(favorite, allGames);
    nextGameInfo = findNextTeamGame(enriched, allGames);
  } catch (error) {
    console.warn('[FavoriteTeamRow] failed to resolve next game:', error);
  }

  const teamHref = buildTeamHref({
    teamId: enriched.espnTeamId,
    name: enriched.name || 'Team',
  });

  const isLive =
    nextGameInfo?.game.normalizedStatus === 'in_progress' ||
    nextGameInfo?.game.normalizedStatus === 'delayed' ||
    nextGameInfo?.game.normalizedStatus === 'suspended';
  // Same naming as ScoresGameCard: shortDisplayName ?? full team name.
  const displayName = enriched.shortDisplayName?.trim() || enriched.name?.trim() || 'Team';

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${displayName} schedule`}
      onPress={() => router.push(teamHref)}
      style={({ pressed }) => [styles.row, !isLast && styles.rowBorder, pressed && styles.rowPressed]}>
      <TeamLogo
        name={enriched.name || displayName}
        abbreviation={enriched.abbreviation}
        logoUrl={enriched.logoUrl}
        size={36}
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {enriched.rank != null ? (
            <Text style={styles.rankText}>#{enriched.rank}</Text>
          ) : null}
          <Text style={styles.teamName} numberOfLines={1}>
            {displayName}
          </Text>
          <FavoriteStar
            teamId={enriched.espnTeamId ?? enriched.key}
            teamName={enriched.name}
            abbreviation={enriched.abbreviation}
            logoUrl={enriched.logoUrl}
            conference={enriched.conference}
            rank={enriched.rank}
            record={enriched.record}
          />
          {enriched.record ? (
            <Text style={styles.recordText} numberOfLines={1}>
              {enriched.record}
            </Text>
          ) : null}
        </View>

        {nextGameInfo ? (
          <View style={styles.nextGameBlock}>
            <Text style={styles.opponentText} numberOfLines={1}>
              {nextGameInfo.opponent}
            </Text>
            <View style={styles.nextMetaRow}>
              {isLive || nextGameInfo.game.normalizedStatus === 'final' ? (
                <>
                  <Text style={styles.nextMetaText}>
                    {formatGameKickoffDate(nextGameInfo.game)}
                  </Text>
                  <Text style={[styles.nextMetaText, isLive && styles.nextMetaLive]}>
                    {isLive ? nextGameInfo.game.status : 'Final'}
                  </Text>
                </>
              ) : (
                <Text style={styles.nextMetaText}>
                  {formatFavoriteUpcomingKickoff(nextGameInfo.game)}
                </Text>
              )}
            </View>
            <CompactWatchLabel game={nextGameInfo.game} stopPropagation />
          </View>
        ) : (
          <Text style={styles.noGameText}>No upcoming game in loaded schedule</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    flexShrink: 0,
  },
  teamName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
    minWidth: 0,
  },
  recordText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 0,
  },
  nextGameBlock: {
    gap: 2,
  },
  opponentText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 16,
  },
  nextMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  nextMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 16,
  },
  nextMetaLive: {
    color: colors.error,
  },
  noGameText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
