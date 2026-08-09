import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
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

export default function SettingsScreen() {
  const {
    preferences,
    userStatusView,
    loaded,
    enablingNotifications,
    retryingSetup,
    updatePreference,
    enableNotifications,
    retryNotificationSetup,
    openSystemSettings,
  } = useNotificationPreferences();

  const actionBusy = enablingNotifications || retryingSetup;

  return (
    <Screen denseTop>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{userStatusView.title}</Text>
          <Text style={styles.statusCopy}>{userStatusView.supportingCopy}</Text>

          {userStatusView.primaryAction === 'enable' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enable Notifications"
              disabled={actionBusy}
              onPress={() => void enableNotifications()}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || actionBusy) && styles.pressed,
              ]}>
              {enablingNotifications ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Enable Notifications</Text>
              )}
            </Pressable>
          ) : null}

          {userStatusView.primaryAction === 'open_settings' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
              onPress={() => void openSystemSettings()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </Pressable>
          ) : null}

          {userStatusView.primaryAction === 'retry' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try Again"
              disabled={actionBusy}
              onPress={() => void retryNotificationSetup()}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || actionBusy) && styles.pressed,
              ]}>
              {retryingSetup ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Try Again</Text>
              )}
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
              onValueChange={(value) => updatePreference({ favoriteGamesEnabled: value })}
            />
            <PreferenceSwitch
              label="Game start"
              value={preferences.gameStartEnabled}
              onValueChange={(value) => updatePreference({ gameStartEnabled: value })}
            />
            <PreferenceSwitch
              label="Scores"
              value={preferences.scoreEnabled}
              onValueChange={(value) => updatePreference({ scoreEnabled: value })}
            />
            <PreferenceSwitch
              label="Quarter endings"
              value={preferences.quarterEndEnabled}
              onValueChange={(value) => updatePreference({ quarterEndEnabled: value })}
            />
            <PreferenceSwitch
              label="Halftime"
              value={preferences.halftimeEnabled}
              onValueChange={(value) => updatePreference({ halftimeEnabled: value })}
            />
            <PreferenceSwitch
              label="Close game"
              value={preferences.closeGameEnabled}
              onValueChange={(value) => updatePreference({ closeGameEnabled: value })}
            />
            <Text style={styles.noteText}>
              Close-game alerts require a verified ESPN close-game signal and are not active yet.
            </Text>
            <PreferenceSwitch
              label="Final"
              value={preferences.finalEnabled}
              onValueChange={(value) => updatePreference({ finalEnabled: value })}
            />
          </>
        )}
      </View>

      <View style={styles.supportSection}>
        <Text style={styles.sectionTitle}>Support</Text>
        <SupportActionCard
          href={'/feedback' as Href}
          icon="chatbubble-ellipses-outline"
          title="Send Feedback"
          subtitle="Bugs, ideas, or anything that would help"
        />
        <SupportActionCard
          href={'/about' as Href}
          icon="information-circle-outline"
          title="About FCS Pulse"
          subtitle="Why this app exists"
        />
      </View>

      <View style={styles.adminSection}>
        <Text style={styles.adminSectionTitle}>Admin</Text>
        <AdminSecondaryRow
          href={'/admin' as Href}
          title="Admin"
          subtitle="Internal tools, media review, and diagnostics"
        />
      </View>
    </Screen>
  );
}

/**
 * Support action card.
 * Card chrome lives on an inner View (not only Pressable) so Expo Router Link + asChild
 * cannot drop background/border styles — which previously left only the icon wells visible.
 */
function SupportActionCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: Href;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityHint="Opens another screen"
        style={({ pressed }) => [
          styles.supportCardPressable,
          pressed && styles.supportCardPressablePressed,
        ]}>
        <View style={styles.supportCard}>
          <View
            style={styles.supportIconWell}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <Ionicons name={icon} size={20} color={colors.text} />
          </View>
          <View style={styles.supportCardText}>
            <Text style={styles.supportCardTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.supportCardSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <View
            style={styles.supportChevron}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** Compact secondary row — findable for owners, de-emphasized for normal users. */
function AdminSecondaryRow({
  href,
  title,
  subtitle,
}: {
  href: Href;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityHint="Opens another screen"
        style={({ pressed }) => [styles.adminRow, pressed && styles.pressed]}>
        <View style={styles.adminRowText}>
          <Text style={styles.adminRowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.adminRowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textMuted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
    </Link>
  );
}

function PreferenceSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.switchControl}>
        <Switch
          accessibilityLabel={label}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primaryMuted }}
          thumbColor={value ? colors.primary : colors.textMuted}
        />
      </View>
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
    color: colors.textSecondary,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  statusCopy: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  noteText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    minWidth: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.caption,
    color: colors.onPrimary,
    fontWeight: '700',
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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  switchControl: {
    flexGrow: 0,
    flexShrink: 0,
  },
  supportSection: {
    gap: 12,
    marginBottom: spacing.md,
    width: '100%',
  },
  supportCardPressable: {
    width: '100%',
    alignSelf: 'stretch',
  },
  supportCardPressablePressed: {
    opacity: 0.88,
  },
  /** Full action chrome — icon + text + chevron all live inside this surface card. */
  supportCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supportIconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
  supportCardText: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  supportCardTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  supportCardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  supportChevron: {
    width: 22,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminSection: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  adminSectionTitle: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
  },
  adminRow: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
  },
  adminRowText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 1,
  },
  adminRowTitle: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  adminRowSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
