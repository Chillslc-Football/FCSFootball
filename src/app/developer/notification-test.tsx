import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  scheduleLocalTestNotification,
  sendExpoPushToCurrentDevice,
} from '@/services/notifications/notificationService';
import { colors, spacing, typography } from '@/theme';

type TestAction = {
  label: string;
  title: string;
  body: string;
  notificationType: string;
};

const TEST_ACTIONS: TestAction[] = [
  {
    label: 'Send local test notification',
    title: 'FCS Pulse test',
    body: 'Local notification delivery check',
    notificationType: 'test',
  },
  {
    label: 'Simulate game start',
    title: 'Montana State vs Idaho is underway',
    body: 'Kickoff',
    notificationType: 'game_start',
  },
  {
    label: 'Simulate scoring play',
    title: 'Touchdown Montana State',
    body: 'Scottre Humphrey 18-yard run\nMontana State 21, Idaho 10 · 5:14 Q3',
    notificationType: 'score',
  },
  {
    label: 'Simulate end of quarter',
    title: 'End of 1st Quarter',
    body: 'Montana State 7, Idaho 7',
    notificationType: 'quarter_end',
  },
  {
    label: 'Simulate halftime',
    title: 'Halftime',
    body: 'Montana State 21, Idaho 10',
    notificationType: 'halftime',
  },
  {
    label: 'Simulate close-game event',
    title: 'Close game alert',
    body: 'Montana State 24, Idaho 21 · 6:42 Q4',
    notificationType: 'close_game',
  },
  {
    label: 'Simulate final',
    title: 'Final',
    body: 'Montana State 34, Idaho 24',
    notificationType: 'final',
  },
];

export default function NotificationTestScreen() {
  const [sendingRemote, setSendingRemote] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.warning}>
        Development only — local notifications do not write production sent-event rows. Remote
        self-push targets only this device via Expo Push and does not create ESPN game records.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send test notification via Expo Push to this device"
        disabled={sendingRemote}
        onPress={() => {
          if (sendingRemote) return;
          setSendingRemote(true);
          void sendExpoPushToCurrentDevice(
            'FCS Pulse remote test',
            'Expo Push delivery check for this device only',
          )
            .then((result) => {
              if (result.ok) {
                Alert.alert('Remote push sent', 'Check the notification tray on this device.');
              } else {
                Alert.alert('Remote push failed', result.error ?? 'Unknown error');
              }
            })
            .finally(() => setSendingRemote(false));
        }}
        style={({ pressed }) => [
          styles.row,
          styles.remoteRow,
          (pressed || sendingRemote) && styles.rowPressed,
        ]}>
        <Text style={styles.rowTitle}>
          {sendingRemote ? 'Sending remote push…' : 'Send Test Notification (Expo Push)'}
        </Text>
        <Text style={styles.rowSubtitle}>
          Uses this device token only — not ESPN poll / not broadcast
        </Text>
      </Pressable>

      {TEST_ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          onPress={() =>
            void scheduleLocalTestNotification(action.title, action.body, {
              eventId: 'test-event',
              notificationType: action.notificationType,
              test: true,
            })
          }
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Text style={styles.rowTitle}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  warning: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  remoteRow: {
    borderColor: colors.primary,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
