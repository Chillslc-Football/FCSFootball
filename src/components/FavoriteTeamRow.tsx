import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TeamLogo } from '@/components/TeamLogo';
import { openWatchOnEspn, resolveEspnWatchTargets } from '@/data/providers/espnWatchLinks';
import {
  enrichFavoriteTeam,
  findNextTeamGame,
} from '@/data/favorites/findNextTeamGame';
import { colors, spacing, typography } from '@/theme';
import { formatGameKickoffDate, formatGameKickoffTime } from '@/utils/formatGameTime';
import { buildTeamHref } from '@/utils/teamId';
import type { EspnNormalizedGame } from '@/types';
import type { FavoriteTeam } from '@/types/favorites';

type FavoriteTeamRowProps = {
  favorite: FavoriteTeam;
  allGames: EspnNormalizedGame[];
  isLast?: boolean;
};

function CompactWatchLabel({ game }: { game: EspnNormalizedGame }) {
  let resolution: ReturnType<typeof resolveEspnWatchTargets>;
  try {
    resolution = resolveEspnWatchTargets(game);
  } catch (error) {
    console.warn('[FavoriteTeamRow] resolveEspnWatchTargets failed:', error);
    return null;
  }

  const [opening, setOpening] = useState(false);
  const broadcast = game.broadcast?.trim();
  const label = broadcast || (resolution.enabled ? 'Watch on ESPN' : '');

  if (!label) return null;

  async function handlePress() {
    if (!resolution.enabled || opening) return;
    setOpening(true);
    try {
      await openWatchOnEspn(game);
    } catch (error) {
      console.warn('[FavoriteTeamRow] openWatchOnEspn failed:', error);
    } finally {
      setOpening(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !resolution.enabled }}
      disabled={!resolution.enabled || opening}
      onPress={(event) => {
        event.stopPropagation();
        void handlePress();
      }}
      style={({ pressed }) => [styles.watchLabel, pressed && resolution.enabled && styles.watchLabelPressed]}>
      {opening ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Text
          style={[styles.watchLabelText, !resolution.enabled && styles.watchLabelDisabled]}
          numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

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

  const isLive = nextGameInfo?.game.normalizedStatus === 'in_progress';
  const displayName = enriched.name?.trim() || 'Team';

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${displayName} schedule`}
      onPress={() => router.push(teamHref)}
      style={({ pressed }) => [styles.row, !isLast && styles.rowBorder, pressed && styles.rowPressed]}>
      <TeamLogo
        name={displayName}
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
          {enriched.record ? (
            <Text style={styles.recordText}>{enriched.record}</Text>
          ) : null}
        </View>

        {nextGameInfo ? (
          <View style={styles.nextGameBlock}>
            <Text style={styles.opponentText} numberOfLines={1}>
              {nextGameInfo.opponent}
            </Text>
            <View style={styles.nextMetaRow}>
              <Text style={styles.nextMetaText}>
                {formatGameKickoffDate(nextGameInfo.game.startTime ?? '')}
              </Text>
              <Text style={[styles.nextMetaText, isLive && styles.nextMetaLive]}>
                {isLive
                  ? nextGameInfo.game.status
                  : nextGameInfo.game.normalizedStatus === 'final'
                    ? 'Final'
                    : formatGameKickoffTime(nextGameInfo.game.startTime)}
              </Text>
            </View>
            <CompactWatchLabel game={nextGameInfo.game} />
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
    color: colors.textMuted,
    lineHeight: 16,
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
