import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import {
  formatGameKickoffTime,
  getDeviceTimezone,
} from '@/utils/formatGameTime';
import type { EspnNormalizedGame } from '@/types';

type GameCardDevDiagnosticsProps = {
  game: EspnNormalizedGame;
};

function formatRawRecords(raw: unknown): string {
  if (raw == null) return 'undefined';
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

/** Temporary __DEV__ panel for record + timezone parsing on one game card. */
export function GameCardDevDiagnostics({ game }: GameCardDevDiagnosticsProps) {
  if (!__DEV__) return null;

  const formattedLocalTime = formatGameKickoffTime(game);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Record & timezone diagnostics</Text>
      <Text style={styles.subtitle}>
        {game.awayTeam} at {game.homeTeam}
      </Text>

      <Text style={styles.sectionLabel}>Records</Text>
      <DiagnosticRow label="Raw away records" value={formatRawRecords(game.awayRecordsRaw)} />
      <DiagnosticRow label="Parsed awayRecord" value={game.awayRecord ?? 'undefined'} />
      <DiagnosticRow label="Raw home records" value={formatRawRecords(game.homeRecordsRaw)} />
      <DiagnosticRow label="Parsed homeRecord" value={game.homeRecord ?? 'undefined'} />

      <Text style={styles.sectionLabel}>Timezone</Text>
      <DiagnosticRow label="Raw ESPN ISO date" value={game.startTime} />
      <DiagnosticRow label="Formatted local time" value={formattedLocalTime} />
      <DiagnosticRow label="Intl resolved timezone" value={getDeviceTimezone()} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  rowValue: {
    ...typography.caption,
    color: colors.text,
    fontSize: 11,
  },
});
