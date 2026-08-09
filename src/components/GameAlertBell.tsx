import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { useFollowedGames } from '@/data/notifications/FollowedGamesContext';
import { ensureNotificationReady } from '@/data/notifications/deviceRegistration';
import { colors } from '@/theme';
import type { EspnNormalizedGame } from '@/types';
import { parseGameStartTime } from '@/utils/formatGameTime';

type GameAlertBellProps = {
  game: EspnNormalizedGame;
};

function gameHasScheduledKickoff(game: EspnNormalizedGame): boolean {
  if (
    game.normalizedStatus === 'in_progress' ||
    game.normalizedStatus === 'delayed' ||
    game.normalizedStatus === 'suspended' ||
    game.normalizedStatus === 'final'
  ) {
    return true;
  }
  return parseGameStartTime(game.startTime) != null;
}

export function GameAlertBell({ game }: GameAlertBellProps) {
  const { isFavorite } = useFavoriteTeams();
  const { isAlertsEnabled, toggleAlerts } = useFollowedGames();
  const [busy, setBusy] = useState(false);

  const awayIsFavorite = isFavorite(game.awayTeamId, game.awayTeam, game.awayAbbreviation);
  const homeIsFavorite = isFavorite(game.homeTeamId, game.homeTeam, game.homeAbbreviation);
  const hasFavoriteTeam = awayIsFavorite || homeIsFavorite;

  const favoriteDefaultEnabled = hasFavoriteTeam;
  const alertsEnabled = isAlertsEnabled(game.id, favoriteDefaultEnabled);
  const hasScheduledKickoff = useMemo(() => gameHasScheduledKickoff(game), [game]);
  const canToggle = hasScheduledKickoff;

  const handlePress = useCallback(async () => {
    if (busy || !canToggle) return;

    const turningOn = !alertsEnabled;
    if (turningOn) {
      const ready = await ensureNotificationReady({ requestPermission: true });
      if (!ready.permissionGranted) {
        Alert.alert(
          'Notifications disabled',
          'Enable notifications in device settings to receive game alerts.',
        );
        return;
      }
    }

    setBusy(true);
    try {
      const ok = await toggleAlerts(game, favoriteDefaultEnabled);
      if (ok) {
        Alert.alert(turningOn ? 'Game alerts enabled' : 'Game alerts disabled');
      }
    } finally {
      setBusy(false);
    }
  }, [alertsEnabled, busy, canToggle, favoriteDefaultEnabled, game, toggleAlerts]);

  const accessibilityLabel = useMemo(() => {
    const matchup = `${game.awayTeam} at ${game.homeTeam}`;
    if (!canToggle) {
      return `Game alerts unavailable until kickoff is scheduled for ${matchup}.`;
    }
    return alertsEnabled
      ? `Disable game alerts for ${matchup}`
      : `Enable game alerts for ${matchup}`;
  }, [alertsEnabled, canToggle, game.awayTeam, game.homeTeam]);

  const iconColor = alertsEnabled ? colors.primary : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: alertsEnabled, disabled: !canToggle }}
      disabled={!canToggle || busy}
      hitSlop={8}
      onPress={(event) => {
        event.stopPropagation?.();
        void handlePress();
      }}
      style={({ pressed }) => [
        styles.button,
        !canToggle && styles.buttonDisabled,
        canToggle && pressed && styles.buttonPressed,
      ]}>
      {busy && canToggle ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={alertsEnabled ? 'notifications' : 'notifications-outline'}
          size={18}
          color={iconColor}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
