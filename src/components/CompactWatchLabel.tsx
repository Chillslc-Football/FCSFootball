import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

import {
  getPrimaryBroadcastNetwork,
  isEspnOwnedBroadcast,
} from '@/data/providers/espnBroadcast';
import { openWatchOnEspn, resolveEspnWatchTargets } from '@/data/providers/espnWatchLinks';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';

export const ESPN_GAMECAST_LINK_LABEL = 'ESPN Gamecast';

type CompactWatchLabelProps = {
  game: EspnNormalizedGame;
  /** Scores/Favorites align start; team schedule aligns end in a narrow column. */
  align?: 'start' | 'end';
  /** Favorites row is itself a Pressable — stop bubbling so the team nav does not fire. */
  stopPropagation?: boolean;
};

export function CompactWatchLabel({
  game,
  align = 'start',
  stopPropagation = false,
}: CompactWatchLabelProps) {
  const resolution = useMemo(() => resolveEspnWatchTargets(game), [game]);
  const [opening, setOpening] = useState(false);

  const networkLabel = getPrimaryBroadcastNetwork(game.broadcast);
  const isEspnFamily = isEspnOwnedBroadcast(game.broadcast);
  const canOpen = resolution.enabled;

  if (!networkLabel && !canOpen) return null;

  async function handlePress() {
    if (!canOpen || opening) return;
    setOpening(true);
    try {
      await openWatchOnEspn(game);
    } finally {
      setOpening(false);
    }
  }

  function onLinkPress(event: GestureResponderEvent) {
    if (stopPropagation) {
      event.stopPropagation();
    }
    void handlePress();
  }

  const alignEnd = align === 'end';
  const stack = alignEnd;
  const linkTextStyle = [styles.linkText, alignEnd && styles.textEnd];
  const networkTextStyle = [
    styles.networkText,
    alignEnd && styles.textEnd,
    !canOpen && styles.disabledText,
  ];
  const rowStyle = [styles.row, alignEnd && styles.rowEnd, stack && styles.rowStack];

  // ESPN family: network name is the single clickable control (when a URL exists).
  if (isEspnFamily && networkLabel) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${networkLabel} on ESPN`}
        accessibilityState={{ disabled: !canOpen }}
        disabled={!canOpen || opening}
        onPress={onLinkPress}
        style={({ pressed }) => [...rowStyle, pressed && canOpen && styles.pressed]}>
        {opening ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text
            style={[styles.linkText, alignEnd && styles.textEnd, !canOpen && styles.disabledText]}
            numberOfLines={1}>
            {networkLabel}
          </Text>
        )}
      </Pressable>
    );
  }

  // Non-ESPN (or missing network): plain network text + optional ESPN Gamecast link.
  return (
    <View style={rowStyle}>
      {networkLabel ? (
        <Text style={networkTextStyle} numberOfLines={1}>
          {networkLabel}
        </Text>
      ) : null}
      {canOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ESPN_GAMECAST_LINK_LABEL}
          accessibilityState={{ disabled: opening }}
          disabled={opening}
          hitSlop={stack ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
          onPress={onLinkPress}
          style={({ pressed }) => [styles.linkHit, pressed && styles.pressed]}>
          {opening ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={linkTextStyle} numberOfLines={1}>
              {ESPN_GAMECAST_LINK_LABEL}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
    paddingVertical: 1,
    maxWidth: '100%',
  },
  rowEnd: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  /** Team schedule right column — network + Gamecast stacked tightly. */
  rowStack: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flexWrap: 'nowrap',
    gap: 0,
    marginTop: 0,
    paddingVertical: 0,
  },
  linkHit: {
    paddingVertical: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  networkText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  linkText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  textEnd: {
    textAlign: 'right',
    fontSize: 10,
    lineHeight: 13,
  },
  disabledText: {
    color: colors.textMuted,
  },
});
