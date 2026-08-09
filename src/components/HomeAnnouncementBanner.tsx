import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type HomeAnnouncementBannerProps = {
  message: string;
  onDismiss: () => void;
};

/**
 * Compact dismissible Home announcement — informational navy/gold card.
 */
export function HomeAnnouncementBanner({ message, onDismiss }: HomeAnnouncementBannerProps) {
  const trimmed = message.trim();
  if (!trimmed) return null;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.message} accessibilityRole="text">
        {trimmed}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss announcement"
        hitSlop={10}
        onPress={onDismiss}
        style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.xs,
  },
  message: {
    ...typography.caption,
    flex: 1,
    color: colors.text,
    lineHeight: 18,
    paddingTop: 2,
  },
  dismiss: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dismissPressed: {
    opacity: 0.7,
  },
});
