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
};

export function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
  style,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, style]}>
      {options.map((option) => {
        const isActive = selected === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(option.id)}
            style={[styles.segment, isActive && styles.segmentActive]}>
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
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
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
});
