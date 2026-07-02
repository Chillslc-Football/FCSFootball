import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Top25TeamCard } from '@/components/Top25TeamCard';
import { MOCK_TOP_25, MOCK_TOP_25_META } from '@/data/mock/top25';
import { colors, spacing, typography } from '@/theme';

export default function Top25Screen() {
  return (
    <Screen title="Top 25" subtitle="FCS poll rankings and team standings.">
      <View style={styles.mockBanner}>
        <Text style={styles.mockLabel}>Mock Data</Text>
        <Text style={styles.mockText}>
          {MOCK_TOP_25_META.pollName} · Week {MOCK_TOP_25_META.week},{' '}
          {MOCK_TOP_25_META.season}
        </Text>
        <Text style={styles.mockHint}>
          Sample rankings for development. Live poll data will replace this later.
        </Text>
      </View>

      <View style={styles.list}>
        {MOCK_TOP_25.map((item) => (
          <Top25TeamCard key={item.team.id} item={item} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mockBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  mockLabel: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mockText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  mockHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
  },
});
