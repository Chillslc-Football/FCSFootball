import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export type ConferenceViewTabId = 'schedule' | 'standings';

type ConferenceViewTabsProps = {
  selected: ConferenceViewTabId;
  onSelect: (id: ConferenceViewTabId) => void;
};

const OPTIONS: { id: ConferenceViewTabId; label: string }[] = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'standings', label: 'Standings' },
];

export function ConferenceViewTabs({ selected, onSelect }: ConferenceViewTabsProps) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {OPTIONS.map((option) => {
        const isActive = selected === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(option.id)}
            style={styles.tab}>
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{option.label}</Text>
            {isActive ? <View style={styles.indicator} /> : <View style={styles.indicatorSpacer} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  tabText: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  indicator: {
    marginTop: spacing.xs,
    height: 3,
    width: '72%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  indicatorSpacer: {
    marginTop: spacing.xs,
    height: 3,
  },
});
