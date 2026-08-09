import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { collectNotificationDiagnosticsProbes } from '@/data/notifications/notificationDiagnostics';
import {
  buildNotificationDiagnosticsLines,
  type NotificationDiagnosticsSnapshot,
} from '@/data/notifications/notificationUserStatus';
import { isExpoGoClient } from '@/data/release/installedAppVersion';
import { colors, spacing, typography } from '@/theme';

export default function NotificationDiagnosticsScreen() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Independent bounded probes — never invent undetermined/false for local fields.
      const probes = await collectNotificationDiagnosticsProbes();
      const full: NotificationDiagnosticsSnapshot = {
        permissionStatus: probes.permissionStatus,
        deviceRegistered: probes.deviceRegistered,
        hasPushToken: probes.hasPushToken,
        backendPrefsLoaded: probes.backendPrefsLoaded,
        platform: probes.platform,
        appEnvironment: isExpoGoClient() ? 'expo_go' : 'installed_build',
        supabaseConfigured: probes.supabaseConfigured,
        projectIdConfigured: probes.projectIdConfigured,
        lastSetupPhase: probes.lastSetupPhase,
        lastSetupResult: probes.lastSetupResult,
        lastSetupDetail: probes.lastSetupDetail,
        deviceUuidPresent: probes.deviceUuidPresent,
        lastFailedProbe: probes.lastFailedProbe,
        pushTokenFailureCategory: probes.pushTokenFailureCategory,
        pushTokenFailureDetail: probes.pushTokenFailureDetail,
      };
      setLines(buildNotificationDiagnosticsLines(full));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostics failed');
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.warning}>
        Developer/Admin only. No push token values are shown. Each probe is independently bounded
        so a slow backend call cannot erase permission or Supabase config.
      </Text>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>Notification Diagnostics</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh notification diagnostics"
        onPress={() => void refresh()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
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
  error: {
    ...typography.caption,
    color: colors.error,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  line: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.caption,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
