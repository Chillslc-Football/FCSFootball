import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import {
  openWatchOnEspn,
  resolveEspnWatchTargets,
} from '@/data/providers/espnWatchLinks';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';

type WatchOnEspnButtonProps = {
  game: EspnNormalizedGame;
  onOpened?: (result: { gameId: string; openedUrl?: string }) => void;
};

export function WatchOnEspnButton({ game, onOpened }: WatchOnEspnButtonProps) {
  const resolution = useMemo(() => resolveEspnWatchTargets(game), [game]);
  const [opening, setOpening] = useState(false);

  async function handlePress() {
    if (!resolution.enabled || opening) return;

    setOpening(true);
    try {
      const result = await openWatchOnEspn(game);
      if (result.openedUrl) {
        onOpened?.({ gameId: game.id, openedUrl: result.openedUrl });
      }
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
      style={({ pressed }) => [
        styles.button,
        !resolution.enabled && styles.buttonDisabled,
        pressed && resolution.enabled && styles.buttonPressed,
      ]}>
      {opening ? (
        <ActivityIndicator color={colors.background} size="small" />
      ) : (
        <Text style={[styles.buttonText, !resolution.enabled && styles.buttonTextDisabled]}>
          Watch on ESPN
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.label,
    color: colors.background,
    fontSize: 10,
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
});
