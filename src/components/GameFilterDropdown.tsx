import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DROPDOWN_CHEVRON_SIZE, dropdownStyles } from '@/components/dropdownStyles';
import {
  findScoresFilterMenuIndex,
  FLAT_SCORES_FILTER_MENU,
  getScoresFilterLabel,
  getScoresFilterMenuItemHeight,
  type FlatScoresFilterItem,
  type ScoresFilterId,
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

function scrollFilterListToIndex(
  listRef: RefObject<FlatList<FlatScoresFilterItem> | null>,
  index: number,
  animated = false,
) {
  if (index < 0) return;

  listRef.current?.scrollToIndex({
    index,
    animated,
    viewPosition: 0.5,
  });
}

export function GameFilterDropdown({ selected, onSelect, style }: GameFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<FlatScoresFilterItem>>(null);

  const selectedLabel = getScoresFilterLabel(selected);
  const selectedIndex = useMemo(
    () => findScoresFilterMenuIndex(FLAT_SCORES_FILTER_MENU, selected),
    [selected],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<FlatScoresFilterItem> | null | undefined, index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        const item = FLAT_SCORES_FILTER_MENU[i];
        if (item) offset += getScoresFilterMenuItemHeight(item);
      }

      const item = FLAT_SCORES_FILTER_MENU[index];
      const length = item ? getScoresFilterMenuItemHeight(item) : 0;

      return { length, offset, index };
    },
    [],
  );

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const offset = Math.max(0, info.averageItemLength * info.index);
      listRef.current?.scrollToOffset({ offset, animated: false });

      requestAnimationFrame(() => {
        scrollFilterListToIndex(listRef, info.index, false);
      });
    },
    [],
  );

  useEffect(() => {
    if (!open || selectedIndex < 0) return;

    const frame = requestAnimationFrame(() => {
      scrollFilterListToIndex(listRef, selectedIndex, false);
    });

    return () => cancelAnimationFrame(frame);
  }, [open, selectedIndex]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const renderItem = useCallback<ListRenderItem<FlatScoresFilterItem>>(
    ({ item }) => {
      if (item.type === 'section-header') {
        return <FilterSectionHeader label={item.label} />;
      }

      const isSelected = selected === item.option.id;
      return (
        <FilterOptionRow
          label={item.option.label}
          selected={isSelected}
          onPress={() => {
            onSelect(item.option.id);
            closeMenu();
          }}
        />
      );
    },
    [closeMenu, onSelect, selected],
  );

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
        onRequestClose={closeMenu}>
        <View style={dropdownStyles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filter menu"
            style={dropdownStyles.backdrop}
            onPress={closeMenu}
          />

          <View style={[dropdownStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={dropdownStyles.sheetHandle} />
            <View style={dropdownStyles.sheetHeader}>
              <Text style={dropdownStyles.sheetTitle}>League & conference</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={closeMenu}
                style={dropdownStyles.closeButton}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <FlatList
              ref={listRef}
              data={FLAT_SCORES_FILTER_MENU}
              keyExtractor={(item) => item.key}
              renderItem={renderItem}
              style={dropdownStyles.sheetScroll}
              contentContainerStyle={dropdownStyles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              initialScrollIndex={selectedIndex >= 0 ? selectedIndex : undefined}
              getItemLayout={getItemLayout}
              onScrollToIndexFailed={handleScrollToIndexFailed}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
