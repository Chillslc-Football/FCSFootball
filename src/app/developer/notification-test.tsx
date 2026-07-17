import { Pressable, StyleSheet, Text, View } from 'react-native';

import { scheduleLocalTestNotification } from '@/services/notifications/notificationService';
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
    title: 'FCSFootball test',
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
  return (
    <View style={styles.container}>
      <Text style={styles.warning}>
        Development only — local notifications do not write production sent-event rows.
      </Text>

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
  rowPressed: {
    opacity: 0.85,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
});
