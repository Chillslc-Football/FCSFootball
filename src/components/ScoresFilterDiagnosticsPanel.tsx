import { StyleSheet, Text, View } from 'react-native';

import type { ScoresFilterDiagnostics } from '@/data/scores/scoresFilters';
import { colors, spacing, typography } from '@/theme';

type ScoresFilterDiagnosticsPanelProps = {
  diagnostics: ScoresFilterDiagnostics;
};

export function ScoresFilterDiagnosticsPanel({ diagnostics }: ScoresFilterDiagnosticsPanelProps) {
  const {
    totalGamesLoaded,
    selectedFilterLabel,
    gamesAfterFilter,
    uniqueConferences,
    divisionValues,
    rankedGamesCount,
    fcsVsFbsGamesCount,
    gamesWithConferenceData,
    gamesWithDivisionData,
  } = diagnostics;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Scores filter diagnostics</Text>
      <Text style={styles.row}>Total games loaded: {totalGamesLoaded}</Text>
      <Text style={styles.row}>Selected filter: {selectedFilterLabel}</Text>
      <Text style={styles.row}>Games after filter: {gamesAfterFilter}</Text>
      <Text style={styles.row}>Ranked games count: {rankedGamesCount}</Text>
      <Text style={styles.row}>FCS vs FBS games count: {fcsVsFbsGamesCount}</Text>
      <Text style={styles.row}>Games with conference data: {gamesWithConferenceData}</Text>
      <Text style={styles.row}>Games with division data: {gamesWithDivisionData}</Text>
      <Text style={styles.label}>Division values found</Text>
      <Text style={styles.detail}>
        {divisionValues.length > 0 ? divisionValues.join(', ') : 'None'}
      </Text>
      <Text style={styles.label}>Unique conference names found</Text>
      <Text style={styles.detail}>
        {uniqueConferences.length > 0 ? uniqueConferences.join(' · ') : 'None'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.label,
    color: colors.primary,
  },
  row: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    marginTop: spacing.xs,
  },
  detail: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
});
