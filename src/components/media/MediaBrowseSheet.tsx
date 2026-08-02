import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dropdownStyles } from '@/components/dropdownStyles';
import {
  createEmptyMediaBrowseFilter,
  filterMediaBrowseTeams,
  getMediaBrowseChips,
  isMediaBrowseFilterActive,
  removeMediaBrowseChip,
  toggleMediaBrowseConference,
  toggleMediaBrowseNational,
  toggleMediaBrowseTeam,
  type MediaBrowseChip,
  type MediaBrowseConferenceOption,
  type MediaBrowseFilter,
  type MediaBrowseTeamOption,
} from '@/data/mediaDirectory/mediaBrowse';
import { colors, spacing, typography } from '@/theme';

type BrowseScreen = 'root' | 'teams' | 'conferences';

/** Shared picker: Discovery browse filters + Suggest coverage tags. */
export type MediaBrowseSheetMode = 'browse' | 'coverage';

type MediaBrowseSheetProps = {
  visible: boolean;
  activeFilter: MediaBrowseFilter;
  teams: MediaBrowseTeamOption[];
  conferences: MediaBrowseConferenceOption[];
  onClose: () => void;
  onChangeFilter: (filter: MediaBrowseFilter) => void;
  /** Defaults to Discovery “Browse Media”; use `coverage` for Suggest. */
  mode?: MediaBrowseSheetMode;
};

export function MediaBrowseSheet({
  visible,
  activeFilter,
  teams,
  conferences,
  onClose,
  onChangeFilter,
  mode = 'browse',
}: MediaBrowseSheetProps) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<BrowseScreen>('root');
  const [teamQuery, setTeamQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isCoverage = mode === 'coverage';

  useEffect(() => {
    if (visible) {
      setScreen('root');
      setTeamQuery('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const filteredTeams = useMemo(
    () => filterMediaBrowseTeams(teams, teamQuery),
    [teams, teamQuery],
  );

  const chips = useMemo(() => getMediaBrowseChips(activeFilter), [activeFilter]);
  const selectedTeamIds = useMemo(
    () => new Set(activeFilter.teams.map((team) => team.id)),
    [activeFilter.teams],
  );
  const selectedConferenceIds = useMemo(
    () => new Set(activeFilter.conferences.map((conference) => conference.id)),
    [activeFilter.conferences],
  );

  const title =
    screen === 'teams'
      ? 'Select Team'
      : screen === 'conferences'
        ? 'Select Conference'
        : isCoverage
          ? 'Select Coverage'
          : 'Browse Media';
  const teamOptionLabel = isCoverage ? 'Teams' : 'Team';
  const conferenceOptionLabel = isCoverage ? 'Conferences' : 'Conference';
  const selectedSectionTitle = isCoverage ? 'Selected Tags' : 'Selected Filters';
  const dismissLabel = isCoverage ? 'Dismiss select coverage' : 'Dismiss browse media';

  const renderTeam: ListRenderItem<MediaBrowseTeamOption> = ({ item, index }) => {
    const selected = selectedTeamIds.has(item.id);
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={item.name}
        onPress={() =>
          onChangeFilter(toggleMediaBrowseTeam(activeFilter, { id: item.id, label: item.name }))
        }
        style={({ pressed }) => [
          styles.checkRow,
          index < filteredTeams.length - 1 && styles.listRowBorder,
          pressed && styles.pressed,
        ]}>
        <Checkbox checked={selected} />
        <Text style={styles.listRowText}>{item.name}</Text>
      </Pressable>
    );
  };

  const renderConference: ListRenderItem<MediaBrowseConferenceOption> = ({ item, index }) => {
    const selected = selectedConferenceIds.has(item.id);
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={item.name}
        onPress={() =>
          onChangeFilter(
            toggleMediaBrowseConference(activeFilter, { id: item.id, label: item.name }),
          )
        }
        style={({ pressed }) => [
          styles.checkRow,
          index < conferences.length - 1 && styles.listRowBorder,
          pressed && styles.pressed,
        ]}>
        <Checkbox checked={selected} />
        <Text style={styles.listRowText}>{item.name}</Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (screen !== 'root') {
          setScreen('root');
          return;
        }
        onClose();
      }}
      statusBarTranslucent={Platform.OS === 'android' ? true : undefined}>
      <KeyboardAvoidingView
        style={dropdownStyles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          style={dropdownStyles.backdrop}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />
        <View
          style={[
            dropdownStyles.sheet,
            styles.sheetKeyboardAware,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}>
          <View style={dropdownStyles.sheetHandle} />
          <View style={dropdownStyles.sheetHeader}>
            {screen !== 'root' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => setScreen('root')}
                style={({ pressed }) => [styles.headerSide, pressed && styles.pressed]}>
                <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
              </Pressable>
            ) : (
              <View style={styles.headerSide} />
            )}
            <Text style={dropdownStyles.sheetTitle}>{title}</Text>
            {screen === 'root' ? (
              isCoverage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  hitSlop={8}
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.headerSide,
                    styles.headerSideEnd,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.headerSide,
                    styles.headerSideEnd,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              )
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                hitSlop={8}
                onPress={() => setScreen('root')}
                style={({ pressed }) => [
                  styles.headerSide,
                  styles.headerSideEnd,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            )}
          </View>

          {screen === 'root' ? (
            <View style={styles.rootBody}>
              <BrowseOption
                label="National"
                checkbox
                selected={activeFilter.national}
                onPress={() => onChangeFilter(toggleMediaBrowseNational(activeFilter))}
              />
              <BrowseOption
                label={teamOptionLabel}
                showChevron
                selected={activeFilter.teams.length > 0}
                onPress={() => setScreen('teams')}
              />
              <BrowseOption
                label={conferenceOptionLabel}
                showChevron
                selected={activeFilter.conferences.length > 0}
                onPress={() => setScreen('conferences')}
                isLast
              />

              {chips.length > 0 ? (
                <View style={styles.selectedSection}>
                  <Text style={styles.selectedTitle}>{selectedSectionTitle}</Text>
                  <MediaBrowseFilterChips
                    chips={chips}
                    onRemove={(chip) => onChangeFilter(removeMediaBrowseChip(activeFilter, chip))}
                  />
                </View>
              ) : null}

              {isMediaBrowseFilterActive(activeFilter) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear all"
                  onPress={() => onChangeFilter(createEmptyMediaBrowseFilter())}
                  style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {screen === 'teams' ? (
            <View
              style={[
                styles.teamPickerBody,
                keyboardHeight > 0 && styles.teamPickerBodyKeyboardOpen,
              ]}>
              <TextInput
                value={teamQuery}
                onChangeText={setTeamQuery}
                placeholder="Search teams..."
                placeholderTextColor={colors.textMuted}
                style={styles.teamSearch}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
                blurOnSubmit={false}
              />
              {filteredTeams.length === 0 ? (
                <Text style={styles.emptyText}>No teams match your search.</Text>
              ) : (
                <FlatList
                  data={filteredTeams}
                  keyExtractor={(item) => item.id}
                  renderItem={renderTeam}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                  style={styles.teamList}
                  contentContainerStyle={[
                    styles.teamListContent,
                    keyboardHeight > 0 && { paddingBottom: spacing.xl },
                  ]}
                />
              )}
            </View>
          ) : null}

          {screen === 'conferences' ? (
            <View style={styles.pickerBody}>
              <FlatList
                data={conferences}
                keyExtractor={(item) => item.id}
                renderItem={renderConference}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MediaBrowseFilterChips({
  chips,
  onRemove,
}: {
  chips: MediaBrowseChip[];
  onRemove: (chip: MediaBrowseChip) => void;
}) {
  if (chips.length === 0) return null;

  return (
    <View style={styles.chipRow}>
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${chip.label} filter`}
          onPress={() => onRemove(chip)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
          <Text style={styles.chipText}>{chip.label}</Text>
          <Ionicons name="close" size={14} color={colors.background} />
        </Pressable>
      ))}
    </View>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Ionicons name="checkmark" size={14} color={colors.background} /> : null}
    </View>
  );
}

function BrowseOption({
  label,
  onPress,
  showChevron = false,
  checkbox = false,
  selected = false,
  isLast = false,
}: {
  label: string;
  onPress: () => void;
  showChevron?: boolean;
  checkbox?: boolean;
  selected?: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={checkbox ? 'checkbox' : 'button'}
      accessibilityState={checkbox ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        !isLast && styles.optionRowBorder,
        selected && !checkbox && styles.optionRowSelected,
        pressed && styles.pressed,
      ]}>
      <View style={styles.optionLabelRow}>
        {checkbox ? <Checkbox checked={selected} /> : null}
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      </View>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheetKeyboardAware: {
    maxHeight: '85%',
  },
  headerSide: {
    minWidth: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSideEnd: {
    alignItems: 'flex-end',
  },
  doneText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 16,
  },
  rootBody: {
    paddingBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  optionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(201, 162, 39, 0.08)',
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  selectedSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  selectedTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  clearButton: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
    fontSize: 15,
  },
  pickerBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    maxHeight: 420,
  },
  /** Team picker: shrinks with KeyboardAvoidingView so results stay above the keyboard. */
  teamPickerBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: 420,
  },
  teamPickerBodyKeyboardOpen: {
    maxHeight: 280,
  },
  teamSearch: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  teamList: {
    flexGrow: 1,
    flexShrink: 1,
  },
  teamListContent: {
    paddingBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    minHeight: 48,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listRowText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
});
