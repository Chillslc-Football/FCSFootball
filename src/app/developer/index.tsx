import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export default function DeveloperScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.warning}>
        Developer tools only — not part of the production app.
      </Text>

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
