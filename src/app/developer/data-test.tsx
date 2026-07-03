import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { mockDataProvider } from '@/data/providers/mockProvider';
import { NCAA_FCS_TOP_25_URL, ncaaRankingsProvider } from '@/data/providers';
import type { ProviderFetchStatus, ProviderResponse } from '@/data/providers/types';
import { colors, spacing, typography } from '@/theme';

const STATUS_LABEL: Record<ProviderFetchStatus, string> = {
  idle: 'Idle',
  loading: 'Loading…',
  success: 'Success',
  error: 'Error',
};

const STATUS_COLOR: Record<ProviderFetchStatus, string> = {
  idle: colors.textMuted,
  loading: colors.primary,
  success: colors.success,
  error: colors.error,
};

export default function DataTestScreen() {
  const [status, setStatus] = useState<ProviderFetchStatus>('idle');
  const [response, setResponse] = useState<ProviderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setResponse(null);

    try {
      const result = await mockDataProvider.fetchSnapshot();
      setResponse(result);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown fetch error');
    }
  }, []);

  const jsonText = response ? JSON.stringify(response.data, null, 2) : null;

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.providerLabel}>Provider</Text>
        <Text style={styles.providerName}>{mockDataProvider.displayName}</Text>
        <Text style={styles.providerId}>ID: {mockDataProvider.id}</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status</Text>
        <View style={[styles.statusBadge, { borderColor: STATUS_COLOR[status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
      </View>

      {response ? (
        <Text style={styles.meta}>
          Response time: {response.durationMs} ms · {response.timestamp}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.fetchButton, pressed && styles.fetchButtonPressed]}
        onPress={handleFetch}
        disabled={status === 'loading'}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.fetchButtonText}>Fetch</Text>
        )}
      </Pressable>

      <View style={styles.jsonContainer}>
        <Text style={styles.jsonLabel}>Response JSON</Text>
        <ScrollView style={styles.jsonScroll} contentContainerStyle={styles.jsonContent}>
          <Text style={styles.jsonText}>
            {jsonText ?? 'Tap Fetch to load a mock provider response.'}
          </Text>
        </ScrollView>
      </View>

      <View style={styles.ncaaSection}>
        <Text style={styles.ncaaSectionTitle}>NCAA Rankings Test</Text>
        <Text style={styles.ncaaSource}>
          Source: NCAA Stats Perform FCS Top 25
        </Text>
        <Text style={styles.ncaaUrl}>{NCAA_FCS_TOP_25_URL}</Text>
        <View style={styles.ncaaStatusBadge}>
          <Text style={styles.ncaaStatusText}>Status: not connected yet</Text>
        </View>
        <Text style={styles.ncaaWhy}>
          Why: ESPN rankings are not reliable for FCS Top 25. Use{' '}
          {ncaaRankingsProvider.id} for poll data; espnScoresProvider for games only.
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
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
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
  fetchButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fetchButtonPressed: {
    opacity: 0.85,
  },
  fetchButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.background,
  },
  jsonContainer: {
    flex: 1,
    minHeight: 200,
  },
  jsonLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
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
  ncaaSection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  ncaaSectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  ncaaSource: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  ncaaUrl: {
    ...typography.caption,
    color: colors.primary,
  },
  ncaaStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ncaaStatusText: {
    ...typography.label,
    color: colors.textMuted,
  },
  ncaaWhy: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
