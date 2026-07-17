import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  return (
    <Screen title="Settings" subtitle="App preferences and configuration.">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>News</Text>
        <Link href={'/(tabs)/news' as Href} asChild>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Text style={styles.rowTitle}>FCS News</Text>
            <Text style={styles.rowSubtitle}>HERO Sports headlines — opens articles externally</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer</Text>
        <Link href={'/developer' as Href} asChild>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Text style={styles.rowTitle}>Developer</Text>
            <Text style={styles.rowSubtitle}>Internal tools and data testing</Text>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
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
