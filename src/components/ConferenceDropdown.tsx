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
  CONFERENCE_MENU,
  getConferenceLabel,
  type ConferenceId,
  type ConferenceMenuEntry,
} from '@/data/conferences/conferenceList';
import { colors, spacing } from '@/theme';

type ConferenceDropdownProps = {
  selected: ConferenceId;
  onSelect: (id: ConferenceId) => void;
  style?: StyleProp<ViewStyle>;
};

function ConferenceOptionRow({
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

function ConferenceSectionHeader({ label }: { label: string }) {
  return (
    <View style={dropdownStyles.sectionHeader}>
      <Text style={dropdownStyles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

function renderMenuEntry(
  entry: ConferenceMenuEntry,
  selected: ConferenceId,
  onSelect: (id: ConferenceId) => void,
  onClose: () => void,
  key: string,
) {
  if (entry.type === 'header') {
    return <ConferenceSectionHeader key={key} label={entry.label} />;
  }

  const { option } = entry;
  return (
    <ConferenceOptionRow
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

export function ConferenceDropdown({ selected, onSelect, style }: ConferenceDropdownProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selectedLabel = getConferenceLabel(selected);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Conference: ${selectedLabel}`}
        accessibilityHint="Opens conference options"
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
            accessibilityLabel="Close conference menu"
            style={dropdownStyles.backdrop}
            onPress={() => setOpen(false)}
          />

          <View style={[dropdownStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={dropdownStyles.sheetHandle} />
            <View style={dropdownStyles.sheetHeader}>
              <Text style={dropdownStyles.sheetTitle}>Select conference</Text>
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
              {CONFERENCE_MENU.map((entry, index) =>
                renderMenuEntry(entry, selected, onSelect, () => setOpen(false), `${entry.type}-${index}`),
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
