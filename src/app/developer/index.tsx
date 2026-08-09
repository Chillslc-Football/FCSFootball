import { Link, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { refreshAppUpdateGateFromDeveloper } from '@/components/AppUpdateGate';
import { resetWelcomeV1Complete } from '@/data/onboarding/welcomeStorage';
import {
  readInstalledMarketingVersion,
  readInstalledNativeBuild,
  resolveReleasePlatform,
  shouldEnforceReleasePolicy,
} from '@/data/release/installedAppVersion';
import {
  clearReleasePolicySimulation,
  getReleasePolicySimulation,
  setReleasePolicySimulation,
  subscribeReleasePolicySimulation,
} from '@/data/release/releasePolicySimulation';
import type { AppUpdateState } from '@/data/release/types';
import { colors, spacing, typography } from '@/theme';

export default function DeveloperScreen() {
  const [resettingWelcome, setResettingWelcome] = useState(false);
  const [simulation, setSimulation] = useState(getReleasePolicySimulation());

  useEffect(() => subscribeReleasePolicySimulation(() => {
    setSimulation(getReleasePolicySimulation());
  }), []);

  const onResetWelcome = useCallback(async () => {
    if (resettingWelcome) return;
    setResettingWelcome(true);
    try {
      await resetWelcomeV1Complete();
      Alert.alert(
        'Version 1 Welcome reset',
        'The welcome screen will show again now (or on the next cold start).',
      );
    } catch (error) {
      Alert.alert(
        'Reset failed',
        error instanceof Error ? error.message : 'Could not reset welcome flag.',
      );
    } finally {
      setResettingWelcome(false);
    }
  }, [resettingWelcome]);

  const onSimulate = useCallback((state: AppUpdateState | null) => {
    if (state == null) {
      clearReleasePolicySimulation();
    } else {
      setReleasePolicySimulation(state);
    }
    Alert.alert(
      'Release policy simulation',
      state == null
        ? 'Simulation cleared. Gate will use remote policy (or stay hidden in Expo Go).'
        : `Simulating: ${state}. Local only — Supabase was not modified.`,
    );
  }, []);

  const platform = resolveReleasePlatform();
  const installedBuild = readInstalledNativeBuild();
  const marketingVersion = readInstalledMarketingVersion();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.warning}>
        Developer tools only — not part of the production app.
      </Text>

      <View style={styles.diagCard}>
        <Text style={styles.diagTitle}>Release policy diagnostics</Text>
        <Text style={styles.diagLine}>Platform: {platform ?? 'n/a'}</Text>
        <Text style={styles.diagLine}>Marketing version: {marketingVersion ?? 'n/a'}</Text>
        <Text style={styles.diagLine}>Native build: {installedBuild ?? 'n/a'}</Text>
        <Text style={styles.diagLine}>
          Enforcement: {shouldEnforceReleasePolicy() ? 'on' : 'bypassed (Expo Go)'}
        </Text>
        <Text style={styles.diagLine}>Simulation: {simulation ?? 'none'}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => onSimulate('current')}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.rowTitle}>Simulate Current</Text>
        <Text style={styles.rowSubtitle}>Hide update gate (local simulation)</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSimulate('optional_update')}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.rowTitle}>Simulate Optional Update</Text>
        <Text style={styles.rowSubtitle}>Show dismissible update prompt</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSimulate('required_update')}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.rowTitle}>Simulate Required Update</Text>
        <Text style={styles.rowSubtitle}>Show blocking update screen (local only)</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSimulate(null)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.rowTitle}>Clear Simulation</Text>
        <Text style={styles.rowSubtitle}>Return to remote policy / Expo Go bypass</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          refreshAppUpdateGateFromDeveloper();
          Alert.alert('Release policy', 'Forced refresh requested.');
        }}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.rowTitle}>Refresh Release Policy</Text>
        <Text style={styles.rowSubtitle}>Fetch Supabase policy now (ignores TTL)</Text>
      </Pressable>

      <Link href={'/developer/data-test' as Href} asChild>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Text style={styles.rowTitle}>Data Test</Text>
          <Text style={styles.rowSubtitle}>Experiment with provider fetch responses</Text>
        </Pressable>
      </Link>

      <Link href={'/developer/espn-test' as Href} asChild>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Text style={styles.rowTitle}>ESPN Data Test</Text>
          <Text style={styles.rowSubtitle}>Scores & schedule via espnScoresProvider</Text>
        </Pressable>
      </Link>

      <Link href={'/developer/ncaa-rankings-test' as Href} asChild>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Text style={styles.rowTitle}>NCAA Rankings Test</Text>
          <Text style={styles.rowSubtitle}>Stats Perform FCS Top 25 — not connected yet</Text>
        </Pressable>
      </Link>

      <Link href={'/developer/notification-diagnostics' as Href} asChild>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Text style={styles.rowTitle}>Notification Diagnostics</Text>
          <Text style={styles.rowSubtitle}>
            Permission, device registration, token present — no secrets
          </Text>
        </Pressable>
      </Link>

      <Link href={'/developer/notification-test' as Href} asChild>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Text style={styles.rowTitle}>Notification Test</Text>
          <Text style={styles.rowSubtitle}>
            Local simulations + Expo Push self-test (this device only)
          </Text>
        </Pressable>
      </Link>

      <Link href={'/developer/live-game-simulator' as Href} asChild>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Text style={styles.rowTitle}>Live Game Simulator</Text>
          <Text style={styles.rowSubtitle}>
            Step through local ESPN fixtures (scores, status, polling) — no network
          </Text>
        </Pressable>
      </Link>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset Version 1 Welcome"
        disabled={resettingWelcome}
        onPress={() => void onResetWelcome()}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.rowTitle}>Reset Version 1 Welcome</Text>
        <Text style={styles.rowSubtitle}>
          Clears fcs_pulse_welcome_v1_complete so the welcome screen can be tested again
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
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
  diagCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  diagTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  diagLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
