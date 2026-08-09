import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Platform } from 'react-native';

import {
  loadNotificationDiagnosticsSnapshot,
  withTimeout,
} from '@/data/notifications/deviceRegistration';
import { getLastNotificationSetupDiagnostic } from '@/data/notifications/notificationSetup';
import {
  buildNotificationDiagnosticsLines,
  type NotificationDiagnosticsSnapshot,
} from '@/data/notifications/notificationUserStatus';
import { isExpoGoClient } from '@/data/release/installedAppVersion';
import { hasExpoProjectIdConfigured } from '@/services/notifications/notificationService';
import { colors, spacing, typography } from '@/theme';

function resolvePlatform(): NotificationDiagnosticsSnapshot['platform'] {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export default function NotificationDiagnosticsScreen() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lastSetup = getLastNotificationSetupDiagnostic();
      const snapshot = await withTimeout(loadNotificationDiagnosticsSnapshot(), 8_000);
      if (!snapshot) {
        setError('Diagnostics timed out. Check Last setup phase below from prior Try Again.');
        setLines([
          ...buildNotificationDiagnosticsLines({
            permissionStatus: 'undetermined',
            deviceRegistered: false,
            hasPushToken: false,
            backendPrefsLoaded: false,
            platform: resolvePlatform(),
            appEnvironment: isExpoGoClient() ? 'expo_go' : 'installed_build',
            supabaseConfigured: false,
            lastSetupPhase: lastSetup.phase,
            lastSetupResult: lastSetup.result,
            lastSetupDetail: lastSetup.detail ?? 'diagnostics_timeout',
            deviceUuidPresent: lastSetup.deviceUuidPresent,
          }),
          `Expo projectId configured: ${hasExpoProjectIdConfigured() ? 'yes' : 'no'}`,
        ]);
        return;
      }

      const full: NotificationDiagnosticsSnapshot = {
        ...snapshot,
        platform: resolvePlatform(),
        appEnvironment: isExpoGoClient() ? 'expo_go' : 'installed_build',
        lastSetupPhase: lastSetup.phase,
        lastSetupResult: lastSetup.result,
        lastSetupDetail: lastSetup.detail,
        deviceUuidPresent: lastSetup.deviceUuidPresent,
      };
      setLines([
        ...buildNotificationDiagnosticsLines(full),
        `Expo projectId configured: ${hasExpoProjectIdConfigured() ? 'yes' : 'no'}`,
      ]);
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
        Developer/Admin only. No push token values are shown. After Settings → Try Again, refresh
        here to see the last setup phase.
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
