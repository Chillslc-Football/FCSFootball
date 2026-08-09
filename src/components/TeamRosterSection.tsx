import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { openMediaUrl } from '@/data/mediaDirectory/openMediaUrl';
import { fetchEspnTeamRoster } from '@/data/providers/espnRosterProvider';
import type { EspnRosterPlayer, EspnTeamRoster } from '@/data/providers/espnRosterParser';
import { colors, spacing, typography } from '@/theme';

type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'empty';

type TeamRosterSectionProps = {
  espnTeamId?: string;
  /** When true, load/refresh roster (lazy until Roster tab is selected). */
  active: boolean;
  /** Bumps when parent pull-to-refresh wants a force reload. */
  refreshToken?: number;
};

function buildPlayerAccessibilityLabel(player: EspnRosterPlayer): string {
  const parts: string[] = [];
  if (player.jersey) parts.push(`Number ${player.jersey}`);
  parts.push(player.displayName);
  if (player.positionDisplayName) parts.push(player.positionDisplayName);
  else if (player.positionAbbreviation) parts.push(player.positionAbbreviation);
  if (player.classYear) parts.push(player.classYear);
  return parts.join(', ');
}

function PlayerMetaLine({ player }: { player: EspnRosterPlayer }) {
  const bits = [
    player.positionAbbreviation,
    player.classYear,
    player.height,
    player.weight,
    player.hometown,
  ].filter(Boolean);
  if (bits.length === 0) return null;
  return (
    <Text style={styles.meta} numberOfLines={2}>
      {bits.join(' · ')}
    </Text>
  );
}

function RosterPlayerRow({
  player,
  isLast,
}: {
  player: EspnRosterPlayer;
  isLast: boolean;
}) {
  const canOpen = Boolean(player.espnPlayerUrl);
  const label = buildPlayerAccessibilityLabel(player);

  const content = (
    <>
      <View style={styles.jerseyCol}>
        <Text style={styles.jerseyText}>{player.jersey ?? '—'}</Text>
      </View>
      {player.headshotUrl ? (
        <Image
          source={{ uri: player.headshotUrl }}
          style={styles.headshot}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.headshotPlaceholder} />
      )}
      <View style={styles.playerText}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.displayName}
        </Text>
        <PlayerMetaLine player={player} />
      </View>
    </>
  );

  if (canOpen) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityHint="Opens ESPN player page"
        onPress={() => void openMediaUrl(player.espnPlayerUrl)}
        style={({ pressed }) => [
          styles.playerRow,
          !isLast && styles.playerRowBorder,
          pressed && styles.playerRowPressed,
        ]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.playerRow, !isLast && styles.playerRowBorder]}>
      {content}
    </View>
  );
}

export function TeamRosterSection({
  espnTeamId,
  active,
  refreshToken = 0,
}: TeamRosterSectionProps) {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [roster, setRoster] = useState<EspnTeamRoster | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rosterRef = useRef<EspnTeamRoster | null>(null);
  rosterRef.current = roster;

  const loadRoster = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      const teamId = espnTeamId?.trim();
      if (!teamId) {
        setRoster(null);
        setLoadState('empty');
        setErrorMessage(null);
        return;
      }

      const keepVisible = (rosterRef.current?.players.length ?? 0) > 0;
      if (!keepVisible) {
        setLoadState('loading');
      }
      setErrorMessage(null);

      try {
        const response = await fetchEspnTeamRoster(teamId, {
          forceRefresh: options?.forceRefresh,
        });
        const next = response.data;
        setRoster(next);
        setLoadState(next.players.length === 0 ? 'empty' : 'success');
      } catch (error) {
        if (keepVisible) {
          setLoadState('success');
          return;
        }
        setRoster(null);
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : "Roster information couldn't be loaded.",
        );
      }
    },
    [espnTeamId],
  );

  useEffect(() => {
    if (!active) return;
    void loadRoster();
  }, [active, espnTeamId, loadRoster]);

  useEffect(() => {
    if (!active || refreshToken <= 0) return;
    void loadRoster({ forceRefresh: true });
  }, [active, refreshToken, loadRoster]);

  if (!active) return null;

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>Loading roster…</Text>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>Roster information couldn&apos;t be loaded.</Text>
        {errorMessage ? <Text style={styles.stateText}>{errorMessage}</Text> : null}
      </View>
    );
  }

  if (loadState === 'empty' || !roster || roster.players.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>Roster information is not currently available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {roster.groups.map((category) => (
        <View key={category.key} style={styles.category}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          {category.positionGroups.map((positionGroup) => (
            <View key={`${category.key}-${positionGroup.key}`} style={styles.positionBlock}>
              <Text style={styles.positionTitle}>{positionGroup.title}</Text>
              <View style={styles.list}>
                {positionGroup.players.map((player, index) => (
                  <RosterPlayerRow
                    key={player.id}
                    player={player}
                    isLast={index === positionGroup.players.length - 1}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  category: {
    gap: spacing.sm,
  },
  categoryTitle: {
    ...typography.heading,
    color: colors.primary,
    fontSize: 18,
  },
  positionBlock: {
    gap: spacing.xs,
  },
  positionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.xs,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  playerRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  playerRowPressed: {
    opacity: 0.85,
    backgroundColor: colors.surfaceElevated,
  },
  jerseyCol: {
    width: 28,
    alignItems: 'center',
  },
  jerseyText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    fontSize: 14,
  },
  headshot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
  },
  headshotPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  playerName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stateBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  errorTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
  },
});
