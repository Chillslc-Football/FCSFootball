import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ConferenceDropdown } from '@/components/ConferenceDropdown';
import { ConferenceScheduleSection } from '@/components/conferences/ConferenceScheduleSection';
import {
  ConferenceStandingsSection,
  ConferenceStandingsTableHeader,
} from '@/components/conferences/ConferenceStandingsSection';
import { ConferenceWeekScroller } from '@/components/conferences/ConferenceWeekScroller';
import {
  ConferenceViewTabs,
  type ConferenceViewTabId,
} from '@/components/conferences/ConferenceViewTabs';
import { Screen } from '@/components/Screen';
import { useSelectedConference } from '@/data/conferences/SelectedConferenceContext';
import { useConferenceStandings } from '@/data/conferences/useConferenceStandings';
import { useConferenceWeekSchedule } from '@/data/conferences/useConferenceWeekSchedule';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing } from '@/theme';
import type { ScheduleWeekId } from '@/types';

export default function ConferencesScreen() {
  const { selectedConference, setSelectedConference } = useSelectedConference();
  const [activeView, setActiveView] = useState<ConferenceViewTabId>('schedule');
  const [selectedWeek, setSelectedWeek] = useState<ScheduleWeekId>('week-1');
  const standings = useConferenceStandings(selectedConference);
  const schedule = useConferenceWeekSchedule(selectedConference, selectedWeek);

  const pullRefresh = useCallback(async () => {
    if (activeView === 'schedule') {
      await schedule.refresh();
      return;
    }
    await standings.refresh();
  }, [activeView, schedule, standings]);

  const { refreshing, onPullToRefresh } = usePullToRefresh(pullRefresh);

  const stickyHeader = useMemo(
    () => (
      <View style={styles.header}>
        <ConferenceDropdown selected={selectedConference} onSelect={setSelectedConference} />
        <ConferenceViewTabs selected={activeView} onSelect={setActiveView} />
      </View>
    ),
    [activeView, selectedConference, setSelectedConference],
  );

  const secondaryStickyHeader = useMemo(() => {
    if (activeView === 'schedule') {
      return (
        <ConferenceWeekScroller selectedWeek={selectedWeek} onSelectWeek={setSelectedWeek} />
      );
    }

    if (
      activeView === 'standings' &&
      standings.loadState === 'success' &&
      standings.entries.length > 0
    ) {
      return <ConferenceStandingsTableHeader />;
    }

    return null;
  }, [activeView, selectedWeek, standings.entries.length, standings.loadState]);

  return (
    <Screen
      denseTop
      stickyHeader={stickyHeader}
      secondaryStickyHeader={secondaryStickyHeader}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onPullToRefresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }>
      {activeView === 'schedule' ? (
        <ConferenceScheduleSection schedule={schedule} />
      ) : (
        <ConferenceStandingsSection conferenceId={selectedConference} standings={standings} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
});
