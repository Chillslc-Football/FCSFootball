import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DROPDOWN_CHEVRON_SIZE, dropdownStyles } from '@/components/dropdownStyles';
import { getScoresWeekDisplayLabel, SCORES_WEEK_OPTIONS } from '@/data/providers/espnScheduleWeek';
import { colors, spacing } from '@/theme';
import type { ScheduleWeekId } from '@/types';

type WeekDropdownProps = {
  selected: ScheduleWeekId;
  onSelect: (id: ScheduleWeekId) => void;
  style?: StyleProp<ViewStyle>;
};

function WeekOptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        dropdownStyles.optionRow,
        selected && dropdownStyles.optionRowSelected,
        pressed && dropdownStyles.optionRowPressed,
      ]}>
      <Text
        style={[dropdownStyles.optionLabel, selected && dropdownStyles.optionLabelSelected]}
        numberOfLines={2}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

export function WeekDropdown({ selected, onSelect, style }: WeekDropdownProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selectedLabel = getScoresWeekDisplayLabel(selected);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Week: ${selectedLabel}`}
        accessibilityHint="Opens week options"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          dropdownStyles.trigger,
          style,
          pressed && dropdownStyles.triggerPressed,
        ]}>
        <Text style={dropdownStyles.triggerLabel} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={DROPDOWN_CHEVRON_SIZE} color={colors.primary} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => setOpen(false)}>
        <View style={dropdownStyles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close week menu"
            style={dropdownStyles.backdrop}
            onPress={() => setOpen(false)}
          />

          <View style={[dropdownStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={dropdownStyles.sheetHandle} />
            <View style={dropdownStyles.sheetHeader}>
              <Text style={dropdownStyles.sheetTitle}>Select week</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={() => setOpen(false)}
                style={dropdownStyles.closeButton}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={dropdownStyles.sheetScroll}
              contentContainerStyle={dropdownStyles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {SCORES_WEEK_OPTIONS.map((option) => (
                <WeekOptionRow
                  key={option.id}
                  label={option.displayLabel}
                  selected={selected === option.id}
                  onPress={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
