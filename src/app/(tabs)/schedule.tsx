import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConferenceDropdown } from '@/components/ConferenceDropdown';
import { ConferenceScheduleSection } from '@/components/conferences/ConferenceScheduleSection';
import { ConferenceStandingsSection } from '@/components/conferences/ConferenceStandingsSection';
import {
  ConferenceViewTabs,
  type ConferenceViewTabId,
} from '@/components/conferences/ConferenceViewTabs';
import { Screen } from '@/components/Screen';
import { useSelectedConference } from '@/data/conferences/SelectedConferenceContext';
import { useConferenceStandings } from '@/data/conferences/useConferenceStandings';
import { spacing } from '@/theme';
import type { ScheduleWeekId } from '@/types';

export default function ConferencesScreen() {
  const { selectedConference, setSelectedConference } = useSelectedConference();
  const [activeView, setActiveView] = useState<ConferenceViewTabId>('schedule');
  const [selectedWeek, setSelectedWeek] = useState<ScheduleWeekId>('week-1');
  const standings = useConferenceStandings(selectedConference);

  return (
    <Screen title="Conferences">
      <View style={styles.header}>
        <ConferenceDropdown selected={selectedConference} onSelect={setSelectedConference} />
        <ConferenceViewTabs selected={activeView} onSelect={setActiveView} />
      </View>

      {activeView === 'schedule' ? (
        <ConferenceScheduleSection
          conferenceId={selectedConference}
          selectedWeek={selectedWeek}
          onSelectWeek={setSelectedWeek}
        />
      ) : (
        <ConferenceStandingsSection conferenceId={selectedConference} standings={standings} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
});
