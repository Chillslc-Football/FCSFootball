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
import {
  getScoresFilterLabel,
  SCORES_FILTER_MENU,
  type ScoresFilterId,
  type ScoresFilterMenuEntry,
} from '@/data/scores/scoresFilters';
import { colors, spacing } from '@/theme';

type GameFilterDropdownProps = {
  selected: ScoresFilterId;
  onSelect: (id: ScoresFilterId) => void;
  style?: StyleProp<ViewStyle>;
};

function FilterOptionRow({
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
      <Text style={[dropdownStyles.optionLabel, selected && dropdownStyles.optionLabelSelected]}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

function FilterSectionHeader({ label }: { label: string }) {
  return (
    <View style={dropdownStyles.sectionHeader}>
      <Text style={dropdownStyles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

function renderMenuEntry(
  entry: ScoresFilterMenuEntry,
  selected: ScoresFilterId,
  onSelect: (id: ScoresFilterId) => void,
  onClose: () => void,
  key: string,
) {
  if (entry.type === 'option') {
    const { option } = entry;
    return (
      <FilterOptionRow
        key={key}
        label={option.label}
        selected={selected === option.id}
        onPress={() => {
          onSelect(option.id);
          onClose();
        }}
      />
    );
  }

  return (
    <View key={key}>
      <FilterSectionHeader label={entry.label} />
      {entry.options.map((option) => (
        <FilterOptionRow
          key={option.id}
          label={option.label}
          selected={selected === option.id}
          onPress={() => {
            onSelect(option.id);
            onClose();
          }}
        />
      ))}
    </View>
  );
}

export function GameFilterDropdown({ selected, onSelect, style }: GameFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const selectedLabel = getScoresFilterLabel(selected);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Filter: ${selectedLabel}`}
        accessibilityHint="Opens filter options"
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
            accessibilityLabel="Close filter menu"
            style={dropdownStyles.backdrop}
            onPress={() => setOpen(false)}
          />

          <View style={[dropdownStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={dropdownStyles.sheetHandle} />
            <View style={dropdownStyles.sheetHeader}>
              <Text style={dropdownStyles.sheetTitle}>Filter games</Text>
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
              {SCORES_FILTER_MENU.map((entry, index) =>
                renderMenuEntry(entry, selected, onSelect, () => setOpen(false), `filter-${index}`),
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
