import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ConferenceMediaSection } from '@/components/media/ConferenceMediaSection';
import { Screen } from '@/components/Screen';
import { getConferenceMetadata } from '@/data/conferences/conferenceList';
import { useSelectedConference } from '@/data/conferences/SelectedConferenceContext';
import { useConferenceStandings } from '@/data/conferences/useConferenceStandings';
import { useConferenceWeekSchedule } from '@/data/conferences/useConferenceWeekSchedule';
import {
  useScoresLiveRefresh,
  type ScoresSilentRefreshOptions,
} from '@/data/scores/useScoresLiveRefresh';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing } from '@/theme';
import type { ScheduleWeekId } from '@/types';

export default function ConferencesScreen() {
  const { selectedConference, setSelectedConference } = useSelectedConference();
  const conferenceLabel =
    getConferenceMetadata(selectedConference)?.displayName ?? selectedConference;
  const [activeView, setActiveView] = useState<ConferenceViewTabId>('schedule');
  const [selectedWeek, setSelectedWeek] = useState<ScheduleWeekId>('week-1');
  const standings = useConferenceStandings(selectedConference);
  const schedule = useConferenceWeekSchedule(selectedConference, selectedWeek);
  const focusInFlightRef = useRef(false);

  const scheduleRefreshSilent = schedule.refreshSilent;
  const standingsRefreshSilent = standings.refreshSilent;
  const scheduleRefresh = schedule.refresh;
  const standingsRefresh = standings.refresh;
  const loadWeekGames = schedule.loadWeekGames;

  const loadScheduleGames = useCallback(
    async (options?: ScoresSilentRefreshOptions) => {
      await loadWeekGames({
        forceRefresh: options?.forceRefresh ?? true,
        silent: options?.silent ?? true,
        trigger: options?.trigger ?? 'conference-schedule-live',
      });
    },
    [loadWeekGames],
  );

  const pullRefresh = useCallback(async () => {
    if (activeView === 'schedule') {
      await scheduleRefresh();
      return;
    }
    await standingsRefresh();
  }, [activeView, scheduleRefresh, standingsRefresh]);

  const { refreshing, onPullToRefresh } = usePullToRefresh(pullRefresh);

  // Focus refresh stays screen-owned so schedule vs standings can diverge.
  useFocusEffect(
    useCallback(() => {
      if (focusInFlightRef.current) return;

      focusInFlightRef.current = true;
      void (async () => {
        try {
          if (activeView === 'schedule') {
            await scheduleRefreshSilent();
          } else {
            await standingsRefreshSilent();
          }
        } finally {
          focusInFlightRef.current = false;
        }
      })();
    }, [activeView, scheduleRefreshSilent, standingsRefreshSilent]),
  );

  // Switching to Standings without leaving the Conferences tab should still
  // force-refresh authoritative ESPN records (not only on screen focus).
  useEffect(() => {
    if (activeView !== 'standings') return;
    void standingsRefreshSilent();
  }, [activeView, selectedConference, standingsRefreshSilent]);

  useScoresLiveRefresh({
    screen: 'Conference',
    visibleGames: schedule.filteredGames,
    loadGames: loadScheduleGames,
    enabled: activeView === 'schedule' && schedule.loadState === 'success',
    refreshOnFocus: false,
    refreshOnAppActive: activeView === 'schedule',
  });

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
      <ConferenceMediaSection
        conferenceId={selectedConference}
        conferenceName={conferenceLabel}
      />
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
