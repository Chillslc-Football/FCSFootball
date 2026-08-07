import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/Screen';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { colors, spacing, typography } from '@/theme';

function permissionLabel(status: string): string {
  switch (status) {
    case 'granted':
      return 'Enabled';
    case 'denied':
      return 'Disabled';
    default:
      return 'Not requested';
  }
}

export default function SettingsScreen() {
  const {
    preferences,
    permissionStatus,
    loaded,
    saving,
    updatePreference,
    openSystemSettings,
  } = useNotificationPreferences();

  return (
    <Screen title="Settings" subtitle="App preferences and configuration.">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Text style={styles.helpText}>
          Favorite-team games are followed automatically. Tap the bell on any other game to receive
          alerts for that matchup.
        </Text>

        <View style={styles.card}>
          <Text style={styles.rowLabel}>Permission status</Text>
          <Text style={styles.rowValue}>{permissionLabel(permissionStatus)}</Text>
          {permissionStatus === 'denied' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void openSystemSettings()}
              style={({ pressed }) => [styles.linkButton, pressed && styles.rowPressed]}>
              <Text style={styles.linkButtonText}>Open device settings</Text>
            </Pressable>
          ) : null}
        </View>

        {!loaded ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <PreferenceSwitch
              label="Favorite-team game alerts"
              value={preferences.favoriteGamesEnabled}
              disabled={saving}
              onValueChange={(value) => void updatePreference({ favoriteGamesEnabled: value })}
            />
            <PreferenceSwitch
              label="Game start"
              value={preferences.gameStartEnabled}
              disabled={saving}
              onValueChange={(value) => void updatePreference({ gameStartEnabled: value })}
            />
            <PreferenceSwitch
              label="Scores"
              value={preferences.scoreEnabled}
              disabled={saving}
              onValueChange={(value) => void updatePreference({ scoreEnabled: value })}
            />
            <PreferenceSwitch
              label="Quarter endings"
              value={preferences.quarterEndEnabled}
              disabled={saving}
              onValueChange={(value) => void updatePreference({ quarterEndEnabled: value })}
            />
            <PreferenceSwitch
              label="Halftime"
              value={preferences.halftimeEnabled}
              disabled={saving}
              onValueChange={(value) => void updatePreference({ halftimeEnabled: value })}
            />
            <PreferenceSwitch
              label="Close game"
              value={preferences.closeGameEnabled}
              disabled={saving}
              onValueChange={(value) => void updatePreference({ closeGameEnabled: value })}
            />
            <Text style={styles.noteText}>
              Close-game alerts require a verified ESPN close-game signal and are not active yet.
            </Text>
            <PreferenceSwitch
              label="Final"
              value={preferences.finalEnabled}
              disabled={saving}
              onValueChange={(value) => void updatePreference({ finalEnabled: value })}
            />
          </>
        )}
      </View>

      {/*
        Admin hub is always linked here to preserve the previous Developer section visibility
        (those tools were not gated). Media Admin screens still require allowlisted sign-in.
      */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin</Text>
        <Link href={'/developer' as Href} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Admin"
            style={({ pressed }) => [styles.adminRow, pressed && styles.rowPressed]}>
            <Text style={styles.adminRowTitle}>Admin</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

function PreferenceSwitch({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primaryMuted }}
        thumbColor={value ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
  },
  helpText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  noteText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  linkButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  linkButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  switchRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  switchLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.sm,
  },
  adminRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  adminRowTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  rowPressed: {
    opacity: 0.85,
  },
});
