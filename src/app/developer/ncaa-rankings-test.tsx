import { StyleSheet, Text, View } from 'react-native';

import { NCAA_FCS_TOP_25_URL, ncaaRankingsProvider } from '@/data/providers';
import { colors, spacing, typography } from '@/theme';

export default function NcaaRankingsTestScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.warning}>
        Developer only — NCAA rankings provider is not connected yet.
      </Text>

      <View style={styles.panel}>
        <Text style={styles.label}>Source</Text>
        <Text style={styles.title}>NCAA Stats Perform FCS Top 25</Text>
        <Text style={styles.url}>{NCAA_FCS_TOP_25_URL}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Provider</Text>
        <Text style={styles.value}>{ncaaRankingsProvider.displayName}</Text>
        <Text style={styles.meta}>ID: {ncaaRankingsProvider.id}</Text>
      </View>

      <View style={styles.statusPanel}>
        <Text style={styles.label}>Status</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Not connected yet</Text>
        </View>
      </View>

      <View style={styles.whyPanel}>
        <Text style={styles.label}>Why not ESPN?</Text>
        <Text style={styles.body}>
          ESPN rankings are not reliable for the official FCS Top 25. This app will
          use NCAA Stats Perform poll data for Top 25 and Rankings screens.
        </Text>
        <Text style={styles.body}>
          ESPN ({`espnScoresProvider`}) is reserved for scores, schedule, game
          status, broadcast info, and game IDs. Ranked badges on game cards will
          later merge NCAA ranks onto ESPN games — rankings still come from NCAA
          only.
        </Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>Coming soon</Text>
        <Text style={styles.placeholderText}>
          Fetch and parse NCAA Top 25 will be added here. No scrape or API call is
          wired yet.
        </Text>
      </View>
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
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  url: {
    ...typography.caption,
    color: colors.primary,
  },
  value: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusPanel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.label,
    color: colors.textMuted,
  },
  whyPanel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  body: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  placeholderTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
