import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import {
  formatCollegeWeekDateRange,
  getScheduleWeekConfig,
  getScoresWeekTitle,
  SCORES_WEEK_OPTIONS,
} from '@/data/providers/espnScheduleWeek';
import { colors, spacing } from '@/theme';
import type { ScheduleWeekId } from '@/types';

type ConferenceWeekScrollerProps = {
  selectedWeek: ScheduleWeekId;
  onSelectWeek: (weekId: ScheduleWeekId) => void;
};

function formatWeekDateRange(weekId: ScheduleWeekId): string {
  const config = getScheduleWeekConfig(weekId);
  return formatCollegeWeekDateRange(config.startDateIso, config.endDateIso).toUpperCase();
}

export function ConferenceWeekScroller({ selectedWeek, onSelectWeek }: ConferenceWeekScrollerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = SCORES_WEEK_OPTIONS.findIndex((option) => option.id === selectedWeek);

  useEffect(() => {
    if (selectedIndex < 0 || !scrollRef.current) return;

    const itemWidth = 108;
    const offset = Math.max(0, selectedIndex * itemWidth - spacing.lg);
    scrollRef.current.scrollTo({ x: offset, animated: true });
  }, [selectedIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroller}>
      {SCORES_WEEK_OPTIONS.map((option) => {
        const isActive = selectedWeek === option.id;
        const weekTitle = getScoresWeekTitle(option.id).toUpperCase();
        const dateRange = formatWeekDateRange(option.id);

        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectWeek(option.id)}
            style={[styles.item, isActive && styles.itemActive]}>
            <Text style={[styles.weekLabel, isActive && styles.weekLabelActive]}>{weekTitle}</Text>
            <Text style={[styles.dateRange, isActive && styles.dateRangeActive]} numberOfLines={1}>
              {dateRange}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    marginBottom: 0,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  item: {
    minWidth: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
  },
  itemActive: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  weekLabelActive: {
    color: colors.text,
  },
  dateRange: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
  dateRangeActive: {
    color: colors.textSecondary,
  },
});
