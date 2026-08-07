import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '@/theme';

/**
 * Visible back control for nested-stack root screens (e.g. Admin / Media admin)
 * where Expo Router has no prior screen in that stack to supply a header back button.
 */
export function StackBackButton({
  label = 'Back',
  fallbackHref,
}: {
  label?: string;
  /** Used only when there is no history to pop (rare cold deep-link). */
  fallbackHref?: string;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        if (fallbackHref) {
          router.replace(fallbackHref as never);
        }
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={26} color={colors.text} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
    paddingRight: spacing.sm,
    minHeight: 44,
  },
  label: {
    ...typography.body,
    color: colors.text,
    marginLeft: -2,
  },
  pressed: { opacity: 0.7 },
});
