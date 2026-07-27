import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export type SegmentedControlOption<T extends string> = {
  id: T;
  label: string;
  accessibilityLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Gold selected state for primary Discover News/Media control. */
  variant?: 'default' | 'accent';
};

export function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
  style,
  accessibilityLabel,
  variant = 'default',
}: SegmentedControlProps<T>) {
  const isAccent = variant === 'accent';

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, isAccent && styles.containerAccent, style]}>
      {options.map((option) => {
        const isActive = selected === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(option.id)}
            style={[
              styles.segment,
              isAccent && styles.segmentCompact,
              isActive && (isAccent ? styles.segmentActiveAccent : styles.segmentActive),
            ]}>
            <Text
              style={[
                styles.segmentText,
                isActive && (isAccent ? styles.segmentTextActiveAccent : styles.segmentTextActive),
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  containerAccent: {
    borderColor: colors.primary,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  segmentCompact: {
    paddingVertical: spacing.xs + 2,
    minHeight: 36,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActiveAccent: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  segmentText: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  segmentTextActiveAccent: {
    color: colors.background,
    fontWeight: '700',
  },
});
