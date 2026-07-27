import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dropdownStyles } from '@/components/dropdownStyles';
import { TeamLogo } from '@/components/TeamLogo';
import {
  filterPickableTeams,
  type PickableFavoriteTeam,
} from '@/data/favorites/buildPickableTeams';
import { favoriteTeamMatchesStored } from '@/data/favorites/favoriteTeamsStorage';
import { colors, spacing, typography } from '@/theme';
import type { FavoriteTeam } from '@/types/favorites';

type AddFavoriteTeamPickerProps = {
  visible: boolean;
  teams: PickableFavoriteTeam[];
  favorites: FavoriteTeam[];
  onClose: () => void;
  onSelectTeam: (team: PickableFavoriteTeam) => void;
};

function PickerTeamRow({
  team,
  alreadyFavorite,
  isLast,
  onPress,
}: {
  team: PickableFavoriteTeam;
  alreadyFavorite: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: alreadyFavorite, selected: alreadyFavorite }}
      disabled={alreadyFavorite}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowBorder,
        alreadyFavorite && styles.rowDisabled,
        pressed && !alreadyFavorite && styles.rowPressed,
      ]}>
      <TeamLogo
        name={team.name}
        abbreviation={team.abbreviation}
        logoUrl={team.logoUrl}
        size={28}
      />
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          {team.rank != null ? (
            <Text style={styles.rankText}>#{team.rank}</Text>
          ) : null}
          <Text style={styles.teamName} numberOfLines={1}>
            {team.name}
          </Text>
        </View>
        {team.conference ? (
          <Text style={styles.metaText} numberOfLines={1}>
            {team.conference}
          </Text>
        ) : null}
      </View>
      {alreadyFavorite ? (
        <Ionicons name="star" size={18} color={colors.primary} />
      ) : (
        <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

export function AddFavoriteTeamPicker({
  visible,
  teams,
  favorites,
  onClose,
  onSelectTeam,
}: AddFavoriteTeamPickerProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filteredTeams = useMemo(
    () => filterPickableTeams(teams, query),
    [teams, query],
  );

  function handleClose() {
    setQuery('');
    onClose();
  }

  function handleSelect(team: PickableFavoriteTeam) {
    onSelectTeam(team);
    setQuery('');
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={dropdownStyles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close team picker"
          style={dropdownStyles.backdrop}
          onPress={handleClose}
        />

        <View style={[dropdownStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={dropdownStyles.sheetHandle} />
          <View style={dropdownStyles.sheetHeader}>
            <Text style={dropdownStyles.sheetTitle}>Add favorite team</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={handleClose}
              style={dropdownStyles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Search teams"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="Search teams"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={dropdownStyles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator={false}>
            {filteredTeams.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {teams.length === 0
                    ? 'No teams loaded yet. Try again after schedule data loads.'
                    : 'No teams match your search.'}
                </Text>
              </View>
            ) : (
              filteredTeams.map((team, index) => {
                const alreadyFavorite = favorites.some((favorite) =>
                  favoriteTeamMatchesStored(favorite, team.key, team.name),
                );

                return (
                  <PickerTeamRow
                    key={team.key}
                    team={team}
                    alreadyFavorite={alreadyFavorite}
                    isLast={index === filteredTeams.length - 1}
                    onPress={() => handleSelect(team)}
                  />
                );
              })
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
    minHeight: 24,
  },
  listScroll: {
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: 420,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  rowDisabled: {
    opacity: 0.65,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  rankText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    flexShrink: 0,
  },
  teamName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyBox: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
