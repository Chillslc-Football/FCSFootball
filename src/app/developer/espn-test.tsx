import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ESPN_FETCH_TIMEOUT_MS } from '@/data/providers/espnFetch';
import { ESPN_FCS_SCOREBOARD_URL, espnScoresProvider } from '@/data/providers/espnProvider';
import type { ProviderFetchStatus, ProviderResponse } from '@/data/providers/types';
import { colors, spacing, typography } from '@/theme';
import type { EspnTodayGamesPayload, EspnTodayGame } from '@/types';

const STATUS_LABEL: Record<ProviderFetchStatus, string> = {
  idle: 'Idle',
  loading: 'Loading',
  success: 'Success',
  error: 'Error',
};

const STATUS_COLOR: Record<ProviderFetchStatus, string> = {
  idle: colors.textMuted,
  loading: colors.primary,
  success: colors.success,
  error: colors.error,
};

function formatScore(game: EspnTodayGame): string | null {
  if (game.awayScore === undefined && game.homeScore === undefined) return null;
  return `${game.awayScore ?? '—'} – ${game.homeScore ?? '—'}`;
}

function GamePreviewRow({ game }: { game: EspnTodayGame }) {
  const scoreLine = formatScore(game);

  return (
    <View style={styles.gameRow}>
      <Text style={styles.gameMatchup} numberOfLines={2}>
        {game.awayTeam} at {game.homeTeam}
      </Text>
      {scoreLine ? <Text style={styles.gameScore}>{scoreLine}</Text> : null}
      <Text style={styles.gameMeta}>{game.status}</Text>
      <Text style={styles.gameMeta}>Start: {game.startTime}</Text>
      <Text style={styles.gameMeta}>ESPN ID: {game.id}</Text>
      {game.espnLink ? (
        <Text style={styles.gameLink} numberOfLines={2}>
          {game.espnLink}
        </Text>
      ) : null}
      {game.broadcast ? <Text style={styles.gameMeta}>TV: {game.broadcast}</Text> : null}
      {game.game ? (
        <Text style={styles.gameInternal}>
          Internal: {game.game.status} · {game.game.scheduledAt}
        </Text>
      ) : null}
    </View>
  );
}

export default function EspnTestScreen() {
  const [status, setStatus] = useState<ProviderFetchStatus>('idle');
  const [response, setResponse] = useState<ProviderResponse<EspnTodayGamesPayload> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Ready to fetch live ESPN FCS scoreboard data.');
  const abortRef = useRef<AbortController | null>(null);

  const handleReset = useCallback(() => {
    console.log('[ESPN Test] Reset requested');
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setError(null);
    setResponse(null);
    setStatusMessage('Ready to fetch live ESPN FCS scoreboard data.');
  }, []);

  const handleFetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setError(null);
    setResponse(null);
    setStatusMessage(`Fetching from ESPN (timeout ${ESPN_FETCH_TIMEOUT_MS / 1000}s)…`);
    console.log('[ESPN Test] Fetching endpoint:', ESPN_FCS_SCOREBOARD_URL);

    let settled = false;

    try {
      const result = await espnScoresProvider.getTodayGames({ signal: controller.signal });

      if (controller.signal.aborted) {
        settled = true;
        return;
      }

      setResponse(result);
      setStatus('success');
      setStatusMessage(
        `Loaded ${result.data.games.length} parsed games for ${result.data.date}.`,
      );
      settled = true;
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('idle');
        setStatusMessage('Fetch cancelled.');
        settled = true;
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Unknown fetch error. ESPN may be unavailable in Expo Go.';
      setStatus('error');
      setError(message);
      setStatusMessage('Fetch failed.');
      console.error('[ESPN Test] Fetch error:', message);
      settled = true;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      if (!settled) {
        const fallback = 'Request did not complete. ESPN may be blocking Expo Go.';
        setStatus('error');
        setError((current) => current ?? fallback);
        setStatusMessage('Fetch failed.');
        console.error('[ESPN Test]', fallback);
      }
    }
  }, []);

  const jsonText = response ? JSON.stringify(response.data.raw, null, 2) : null;
  const isLoading = status === 'loading';

  return (
    <View style={styles.container}>
      <Text style={styles.warning}>
        Developer only — live ESPN scores/schedule fetch (espnScoresProvider). Not wired to production.
      </Text>

      <View style={styles.panel}>
        <Text style={styles.providerLabel}>Provider</Text>
        <Text style={styles.providerName}>{espnScoresProvider.displayName}</Text>
        <Text style={styles.providerId}>ID: {espnScoresProvider.id}</Text>
        <Text style={styles.endpoint} numberOfLines={3}>
          {ESPN_FCS_SCOREBOARD_URL}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status</Text>
        <View style={[styles.statusBadge, { borderColor: STATUS_COLOR[status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
      </View>

      <Text style={styles.statusMessage}>{statusMessage}</Text>

      {response ? (
        <Text style={styles.meta}>Response time: {response.durationMs} ms</Text>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.fetchButton,
            styles.fetchButtonPrimary,
            pressed && styles.fetchButtonPressed,
            isLoading && styles.fetchButtonDisabled,
          ]}
          onPress={handleFetch}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.fetchButtonTextPrimary}>Fetch Today&apos;s Games</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.fetchButton, styles.resetButton, pressed && styles.fetchButtonPressed]}
          onPress={handleReset}
          disabled={!isLoading && status === 'idle' && !error && !response}>
          <Text style={styles.resetButtonText}>Cancel / Reset</Text>
        </Pressable>
      </View>

      {response ? (
        <View style={styles.previewSection}>
          <Text style={styles.sectionLabel}>
            Parsed Games ({response.data.games.length})
          </Text>
          {response.data.games.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                ESPN returned data but no games could be parsed.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.previewScroll} nestedScrollEnabled>
              <View style={styles.previewList}>
                {response.data.games.map((game) => (
                  <GamePreviewRow key={game.id} game={game} />
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      ) : null}

      <View style={styles.jsonContainer}>
        <Text style={styles.sectionLabel}>Raw JSON Preview</Text>
        <ScrollView style={styles.jsonScroll} contentContainerStyle={styles.jsonContent}>
          <Text style={styles.jsonText}>
            {jsonText ?? 'Tap Fetch Today\'s Games to load the ESPN response.'}
          </Text>
        </ScrollView>
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
  providerLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  providerName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  providerId: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  endpoint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  statusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.label,
    fontSize: 11,
  },
  statusMessage: {
    ...typography.body,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
  },
  errorTitle: {
    ...typography.label,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
  },
  buttonRow: {
    gap: spacing.sm,
  },
  fetchButton: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fetchButtonPrimary: {
    backgroundColor: colors.primary,
  },
  fetchButtonDisabled: {
    opacity: 0.9,
  },
  fetchButtonPressed: {
    opacity: 0.85,
  },
  fetchButtonTextPrimary: {
    ...typography.body,
    fontWeight: '700',
    color: colors.background,
  },
  resetButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  previewSection: {
    gap: spacing.sm,
    maxHeight: 220,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  previewScroll: {
    maxHeight: 200,
  },
  previewList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  gameRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  gameMatchup: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  gameScore: {
    ...typography.heading,
    fontSize: 16,
    color: colors.primary,
  },
  gameMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  gameLink: {
    ...typography.caption,
    color: colors.primary,
  },
  gameInternal: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  jsonContainer: {
    flex: 1,
    minHeight: 160,
  },
  jsonScroll: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jsonContent: {
    padding: spacing.md,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
