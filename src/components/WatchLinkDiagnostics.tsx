import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveEspnWatchTargets } from '@/data/providers/espnWatchLinks';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';

type WatchLinkDiagnosticsProps = {
  games: EspnNormalizedGame[];
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
  lastOpenedUrl?: string | null;
};

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

export function WatchLinkDiagnostics({
  games,
  selectedGameId,
  onSelectGame,
  lastOpenedUrl,
}: WatchLinkDiagnosticsProps) {
  const selectedGame =
    games.find((game) => game.id === selectedGameId) ?? games[0] ?? null;
  const resolution = useMemo(
    () => (selectedGame ? resolveEspnWatchTargets(selectedGame) : null),
    [selectedGame],
  );

  if (!selectedGame || !resolution) {
    return null;
  }

  const apiUrlLines =
    resolution.apiUrls.length > 0
      ? resolution.apiUrls
          .map(
            (link) =>
              `[${link.rel.join(', ') || 'link'}] ${link.href}${link.text ? ` (${link.text})` : ''}`,
          )
          .join('\n')
      : 'None in ESPN event.links';

  const deepLinkLines =
    resolution.deepLinkCandidates.length > 0
      ? resolution.deepLinkCandidates.join('\n')
      : 'None';

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Watch link diagnostics</Text>
      <Text style={styles.subtitle}>
        {selectedGame.awayTeam} at {selectedGame.homeTeam}
      </Text>

      <View style={styles.selectorRow}>
        {games.slice(0, 4).map((game) => {
          const active = game.id === selectedGame.id;
          return (
            <Pressable
              key={game.id}
              onPress={() => onSelectGame(game.id)}
              style={[styles.selectorChip, active && styles.selectorChipActive]}>
              <Text
                style={[styles.selectorChipText, active && styles.selectorChipTextActive]}
                numberOfLines={1}>
                {game.id}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <DiagnosticRow label="ESPN Game ID" value={resolution.gameId} />
      <DiagnosticRow label="ESPN UID" value={resolution.espnUid ?? '—'} />
      <DiagnosticRow label="API URLs" value={apiUrlLines} />
      <DiagnosticRow label="Deep link candidates" value={deepLinkLines} />
      <DiagnosticRow
        label="Watch button target"
        value={resolution.preferredUrl ?? 'Disabled'}
      />
      {lastOpenedUrl ? (
        <DiagnosticRow label="Last opened URL" value={lastOpenedUrl} />
      ) : null}
      {resolution.notes.length > 0 ? (
        <DiagnosticRow label="Notes" value={resolution.notes.join('\n')} />
      ) : null}
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
    gap: spacing.sm,
  },
  title: {
    ...typography.label,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  selectorChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: 120,
  },
  selectorChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
  },
  selectorChipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  selectorChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  rowValue: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
});
