import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DROPDOWN_CHEVRON_SIZE, dropdownStyles } from '@/components/dropdownStyles';
import {
  MEDIA_PLATFORM_LINK_KEYS,
  MEDIA_PLATFORM_LINK_LABELS,
  type MediaPlatformLinkKey,
} from '@/data/mediaDirectory/mediaPlatformLinks';
import { colors, spacing } from '@/theme';

type MediaPlatformPickerProps = {
  value: MediaPlatformLinkKey;
  onChange: (platform: MediaPlatformLinkKey) => void;
};

export function MediaPlatformPicker({ value, onChange }: MediaPlatformPickerProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selectedLabel = MEDIA_PLATFORM_LINK_LABELS[value];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Platform: ${selectedLabel}`}
        accessibilityHint="Opens platform options"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          dropdownStyles.trigger,
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
            accessibilityLabel="Close platform menu"
            style={dropdownStyles.backdrop}
            onPress={() => setOpen(false)}
          />

          <View
            style={[dropdownStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={dropdownStyles.sheetHandle} />
            <View style={dropdownStyles.sheetHeader}>
              <Text style={dropdownStyles.sheetTitle}>Select platform</Text>
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
              {MEDIA_PLATFORM_LINK_KEYS.map((key) => {
                const selected = value === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      dropdownStyles.optionRow,
                      selected && dropdownStyles.optionRowSelected,
                      pressed && dropdownStyles.optionRowPressed,
                    ]}>
                    <Text
                      style={[
                        dropdownStyles.optionLabel,
                        selected && dropdownStyles.optionLabelSelected,
                      ]}
                      numberOfLines={1}>
                      {MEDIA_PLATFORM_LINK_LABELS[key]}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
