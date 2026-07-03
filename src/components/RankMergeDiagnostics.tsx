import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import type { RankingMergeResult } from '@/data/providers/rankingMerge';

type RankMergeDiagnosticsProps = {
  result: RankingMergeResult | null;
};

export function RankMergeDiagnostics({ result }: RankMergeDiagnosticsProps) {
  if (!result) return null;

  const unmatched =
    result.unmatchedRankedTeams.length > 0
      ? result.unmatchedRankedTeams.map((t) => `#${t.rank} ${t.team.name}`).join(', ')
      : 'None';

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Ranking merge diagnostics</Text>
      <Text style={styles.row}>Ranked teams loaded: {result.rankedTeamsLoaded}</Text>
      <Text style={styles.row}>Games with rank matches: {result.gamesWithRankMatches}</Text>
      <Text style={styles.row}>Rank badges applied: {result.matchedRankCount}</Text>
      <Text style={styles.label}>Unmatched ranked teams</Text>
      <Text style={styles.unmatched}>{unmatched}</Text>
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
  unmatched: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
});
