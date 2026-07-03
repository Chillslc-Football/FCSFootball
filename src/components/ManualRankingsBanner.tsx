import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type ManualRankingsBannerProps = {
  pollName: string;
  updatedLabel: string;
  updatedAt: string;
};

export function ManualRankingsBanner({
  pollName,
  updatedLabel,
  updatedAt,
}: ManualRankingsBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.pollTitle}>{pollName}</Text>
      <View style={styles.manualBadge}>
        <Text style={styles.manualBadgeText}>Manual rankings data</Text>
      </View>
      <Text style={styles.sourceLine}>Source: NCAA</Text>
      <Text style={styles.updatedLine}>
        {updatedLabel} · File updated {updatedAt}
      </Text>
      <Text style={styles.disclaimer}>
        Not live — edit src/data/static/fcsTop25.json weekly from the official NCAA poll.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  pollTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  manualBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  manualBadgeText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 10,
  },
  sourceLine: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  updatedLine: {
    ...typography.caption,
    color: colors.textMuted,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
