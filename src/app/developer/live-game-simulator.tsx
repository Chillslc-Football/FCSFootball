import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ESPN_LIVE_GAME_FIXTURE_SEQUENCE,
  ESPN_SPECIAL_STATE_FIXTURE_KEYS,
  SIM_AWAY_NAME,
  SIM_HOME_NAME,
  getEspnLiveGameFixture,
  type EspnLiveGameFixtureKey,
} from '@/data/providers/espnLiveGameFixtures';
import {
  formatEspnGameStatusLabel,
  shouldPollEspnNormalizedStatus,
} from '@/data/providers/espnGameStatus';
import { formatEspnGameSituationLine } from '@/data/providers/espnGameSituation';
import { parseFixtureGame } from '@/data/scores/liveGameSimulation';
import { colors, spacing, typography } from '@/theme';

const SEQUENCE: EspnLiveGameFixtureKey[] = [
  ...ESPN_LIVE_GAME_FIXTURE_SEQUENCE,
  ...ESPN_SPECIAL_STATE_FIXTURE_KEYS,
];

export default function LiveGameSimulatorScreen() {
  const [index, setIndex] = useState(0);
  const key = SEQUENCE[index];

  const game = useMemo(() => parseFixtureGame(getEspnLiveGameFixture(key)), [key]);
  const display = formatEspnGameStatusLabel(game);
  const polling = shouldPollEspnNormalizedStatus(game.normalizedStatus);
  const clockHint = game.statusShortDetail?.trim() || display;
  const situationLine = formatEspnGameSituationLine(game);

  return (
    <View style={styles.container}>
      <Text style={styles.warning}>
        Local fixtures only — never writes Supabase, never sends push, never touches production ESPN
        fetch.
      </Text>

      <Text style={styles.title}>Live Game Simulator</Text>

      <View style={styles.scoreBlock}>
        <Text style={styles.teamLine}>
          {SIM_AWAY_NAME} {game.awayScore ?? 0}
        </Text>
        <Text style={styles.teamLine}>
          {SIM_HOME_NAME} {game.homeScore ?? 0}
        </Text>
        <Text style={styles.meta}>{clockHint}</Text>
        {situationLine ? <Text style={styles.situation}>{situationLine}</Text> : null}
      </View>

      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, index === 0 && styles.buttonDisabled]}
          disabled={index === 0}
          onPress={() => setIndex((value) => Math.max(0, value - 1))}>
          <Text style={styles.buttonText}>Previous State</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            index >= SEQUENCE.length - 1 && styles.buttonDisabled,
          ]}
          disabled={index >= SEQUENCE.length - 1}
          onPress={() => setIndex((value) => Math.min(SEQUENCE.length - 1, value + 1))}>
          <Text style={styles.buttonText}>Next State</Text>
        </Pressable>
      </View>

      <Text style={styles.detail}>Fixture key: {key}</Text>
      <Text style={styles.detail}>
        Current normalized status:{'\n'}
        {game.normalizedStatus ?? 'unknown'}
      </Text>
      <Text style={styles.detail}>
        Polling:{'\n'}
        {polling ? 'ON' : 'OFF'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  warning: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  scoreBlock: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  teamLine: {
    ...typography.heading,
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  situation: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
