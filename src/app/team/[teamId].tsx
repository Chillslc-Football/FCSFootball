import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamLogo } from '@/components/TeamLogo';
import { FavoriteStarButton } from '@/components/FavoriteStarButton';
import { TeamMediaSection } from '@/components/media/TeamMediaSection';
import { TeamRosterSection } from '@/components/TeamRosterSection';
import { TeamScheduleGameRow } from '@/components/TeamScheduleGameRow';
import { SegmentedControl } from '@/components/SegmentedControl';

import {
  loadTeamSeasonData,
  TEAM_SCHEDULE_PARTIAL_NOTE,
  TEAM_SCHEDULE_SOURCE_NOTE,
  type TeamProfile,
} from '@/data/teams/loadTeamSeasonGames';
import { useSelectedConference } from '@/data/conferences/SelectedConferenceContext';
import { resolveConferenceId } from '@/data/conferences/resolveConferenceId';
import { lookupEspnConference, resolveEspnConferenceName } from '@/data/providers/espnConferenceLookup';
import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import {
  useScoresLiveRefresh,
  type ScoresSilentRefreshOptions,
} from '@/data/scores/useScoresLiveRefresh';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing, typography } from '@/theme';
import { getTeamDetailHeading } from '@/utils/teamDisplay';
import { isEspnTeamId } from '@/utils/teamId';
import type { EspnNormalizedGame } from '@/types';

type LoadState = 'loading' | 'success' | 'error';
type TeamPageTabId = 'schedule' | 'roster';

const TEAM_PAGE_TABS: { id: TeamPageTabId; label: string }[] = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'roster', label: 'Roster' },
];

function isPureNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function isInternalTeamIdentifier(value: string, profile: TeamProfile): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed === profile.routeId || trimmed === profile.espnTeamId) return true;
  if (isPureNumericId(trimmed)) return true;
  return isEspnTeamId(trimmed) && trimmed === profile.espnTeamId;
}

function resolveConferenceLabel(profile: TeamProfile): string | undefined {
  const raw = profile.conference?.trim();
  if (!raw || isInternalTeamIdentifier(raw, profile)) return undefined;

  if (isPureNumericId(raw)) {
    return lookupEspnConference(raw)?.name ?? resolveEspnConferenceName(raw);
  }

  return raw;
}

function buildHeaderSecondaryMeta(profile: TeamProfile): string[] {
  const parts: string[] = [];

  const record = profile.record?.trim();
  if (record) {
    parts.push(`Record ${record}`);
  }

  const abbreviation = profile.abbreviation?.trim();
  if (abbreviation && !isInternalTeamIdentifier(abbreviation, profile)) {
    parts.push(abbreviation);
  }

  return parts;
}

function resolveHeaderTitle(profile: TeamProfile, title: string): string {
  const trimmed = title.trim();
  if (!isPureNumericId(trimmed)) return trimmed;

  const displayName = profile.displayName?.trim();
  if (displayName && !isPureNumericId(displayName)) return displayName;

  const abbreviation = profile.abbreviation?.trim();
  if (abbreviation && !isPureNumericId(abbreviation)) return abbreviation;

  return 'Team';
}

function resolveHeaderMascot(profile: TeamProfile, mascot?: string): string | undefined {
  const trimmed = mascot?.trim();
  if (!trimmed || isInternalTeamIdentifier(trimmed, profile)) return undefined;
  return trimmed;
}

function TeamHeader({ profile, routeId }: { profile: TeamProfile; routeId: string }) {
  const router = useRouter();
  const { setSelectedConference } = useSelectedConference();

  const heading = getTeamDetailHeading({
    displayName: profile.displayName,
    location: profile.location,
    mascot: profile.mascot,
  });

  const conferenceLabel = resolveConferenceLabel(profile);
  const conferenceId = resolveConferenceId(profile.conference);
  const secondaryMeta = buildHeaderSecondaryMeta(profile);
  const headerTitle = resolveHeaderTitle(profile, heading.title);
  const headerMascot = resolveHeaderMascot(profile, heading.mascot);

  function handleConferencePress() {
    if (!conferenceId) return;
    setSelectedConference(conferenceId);
    router.push('/(tabs)/schedule');
  }

  return (
    <View style={styles.headerCard}>
      <TeamLogo
        name={profile.displayName}
        abbreviation={profile.abbreviation}
        logoUrl={profile.logoUrl}
        size={36}
      />
      <View style={styles.headerInfo}>
        <View style={styles.nameRow}>
          {profile.rank != null ? (
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>#{profile.rank}</Text>
            </View>
          ) : null}
          <Text style={styles.teamName} numberOfLines={2}>
            {headerTitle}
          </Text>
        </View>
        {headerMascot ? (
          <Text style={styles.metaText} numberOfLines={1}>
            {headerMascot}
          </Text>
        ) : null}
        {conferenceLabel || secondaryMeta.length > 0 ? (
          <View style={styles.metaRow}>
            {conferenceLabel ? (
              conferenceId ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`View ${conferenceLabel} on Conferences tab`}
                  hitSlop={4}
                  onPress={handleConferencePress}
                  style={({ pressed }) => [pressed && styles.metaLinkPressed]}>
                  <Text style={styles.metaText}>{conferenceLabel}</Text>
                </Pressable>
              ) : (
                <Text style={styles.metaText}>{conferenceLabel}</Text>
              )
            ) : null}
            {conferenceLabel && secondaryMeta.length > 0 ? (
              <Text style={styles.metaText}> · </Text>
            ) : null}
            {secondaryMeta.length > 0 ? (
              <Text style={styles.metaText} numberOfLines={2}>
                {secondaryMeta.join(' · ')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <FavoriteStarButton profile={profile} routeId={routeId} />
    </View>
  );
}

export default function TeamDetailScreen() {
  const insets = useSafeAreaInsets();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const routeId = teamId ?? '';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [isPartialSchedule, setIsPartialSchedule] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TeamPageTabId>('schedule');
  const [rosterRefreshToken, setRosterRefreshToken] = useState(0);
  const hasDataRef = useRef(false);
  const loadedRouteRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const activeTabRef = useRef<TeamPageTabId>('schedule');
  activeTabRef.current = activeTab;

  const loadTeam = useCallback(
    async (options?: ScoresSilentRefreshOptions) => {
      if (!routeId) {
        setLoadState('error');
        setErrorMessage('Team not found.');
        return;
      }

      if (loadedRouteRef.current !== routeId) {
        loadedRouteRef.current = routeId;
        hasDataRef.current = false;
        setActiveTab('schedule');
        setRosterRefreshToken(0);
      }

      if (inFlightRef.current && !options?.forceRefresh) {
        return inFlightRef.current;
      }

      const silent = options?.silent ?? false;
      const forceRefresh = options?.forceRefresh ?? false;
      const trigger = options?.trigger ?? 'team-mount';
      const pullRefresh = trigger.endsWith('-ptr');

      const run = (async () => {
        if (!silent && !hasDataRef.current) {
          setLoadState('loading');
          setErrorMessage(null);
        }

        logEspnRefreshDev({
          source: 'ESPN',
          screen: 'Team',
          trigger,
          phase: 'start',
          note: `${routeId} force=${forceRefresh} currentWeekOnly=${Boolean(options?.currentWeekOnly)}`,
        });

        try {
          const data = await loadTeamSeasonData(routeId, {
            forceRefresh,
            currentWeekOnly: options?.currentWeekOnly,
            trigger,
            pullRefresh,
          });
          setProfile(data.profile);
          setGames(data.games);
          setIsPartialSchedule(data.isPartialSchedule);
          setLoadState('success');
          hasDataRef.current = true;
          logEspnRefreshDev({
            source: 'ESPN',
            screen: 'Team',
            trigger,
            phase: 'success',
            count: data.games.length,
            note: data.isPartialSchedule
              ? `partial weeks=${data.failedWeekIds.join(',')}`
              : undefined,
          });
        } catch (err) {
          logEspnRefreshDev({
            source: 'ESPN',
            screen: 'Team',
            trigger,
            phase: 'error',
            error: err,
          });

          if (hasDataRef.current) {
            console.warn('[TeamDetailScreen] refresh failed; keeping previous team data:', err);
            setLoadState('success');
            return;
          }

          setProfile(null);
          setGames([]);
          setIsPartialSchedule(false);
          setErrorMessage(err instanceof Error ? err.message : 'Could not load team data.');
          setLoadState('error');
        }
      })();

      inFlightRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightRef.current === run) inFlightRef.current = null;
      }
    },
    [routeId],
  );

  useScoresLiveRefresh({
    screen: 'Team',
    visibleGames: games,
    loadGames: loadTeam,
    // Live score polling only while viewing schedule (not roster).
    enabled: Boolean(routeId) && activeTab === 'schedule',
  });

  const { refreshing, onPullToRefresh } = usePullToRefresh(
    useCallback(async () => {
      if (activeTabRef.current === 'roster') {
        setRosterRefreshToken((value) => value + 1);
        return;
      }
      await loadTeam({ forceRefresh: true, silent: true, trigger: 'team-ptr' });
    }, [loadTeam]),
  );

  const screenTitle = profile
    ? resolveHeaderTitle(profile, profile.displayName ?? profile.name ?? 'Team')
    : 'Team';

  const espnTeamIdForMedia =
    profile?.espnTeamId?.trim() ||
    (routeId && isEspnTeamId(routeId) ? routeId.trim() : '');

  const teamConferenceId = profile ? resolveConferenceId(profile.conference) : undefined;
  const teamConferenceName = profile ? resolveConferenceLabel(profile) : undefined;

  return (
    <>
      <Stack.Screen options={{ title: screenTitle, headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.xl) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onPullToRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}>
        {loadState === 'loading' ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading team schedule…</Text>
          </View>
        ) : null}

        {loadState === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load team</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {loadState === 'success' && profile ? (
          <>
            <TeamHeader profile={profile} routeId={routeId} />

            {espnTeamIdForMedia ? (
              <TeamMediaSection
                espnTeamId={espnTeamIdForMedia}
                teamName={screenTitle}
                conferenceId={teamConferenceId}
                conferenceName={teamConferenceName}
              />
            ) : null}

            <SegmentedControl
              accessibilityLabel="Team page sections"
              options={TEAM_PAGE_TABS}
              selected={activeTab}
              onSelect={setActiveTab}
              style={styles.tabControl}
              compact
            />

            {activeTab === 'schedule' ? (
              <>
                <View style={styles.scheduleIntro}>
                  <Text style={styles.sourceNote} numberOfLines={1}>
                    {TEAM_SCHEDULE_SOURCE_NOTE}
                  </Text>
                  {isPartialSchedule ? (
                    <Text style={styles.sourceNote}>{TEAM_SCHEDULE_PARTIAL_NOTE}</Text>
                  ) : null}
                  <Text style={styles.sectionTitle}>Season schedule & results</Text>
                </View>

                {games.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTitle}>No games found for {profile.name}.</Text>
                    <Text style={styles.emptyText}>
                      Games appear here when ESPN scoreboard data includes this team for loaded
                      weeks.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.scheduleList}>
                    {games.map((game, index) => (
                      <TeamScheduleGameRow
                        key={game.id}
                        game={game}
                        isLast={index === games.length - 1}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <TeamRosterSection
                espnTeamId={espnTeamIdForMedia}
                active={activeTab === 'roster'}
                refreshToken={rosterRefreshToken}
              />
            )}
          </>
        ) : null}

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tabControl: {
    marginTop: 2,
  },
  scheduleIntro: {
    gap: 4,
  },
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.lg,
  },
  errorTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  rankBadge: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankBadgeText: {
    ...typography.label,
    color: colors.onPrimary,
    fontSize: 9,
  },
  teamName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 21,
    minWidth: 0,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaLinkPressed: {
    opacity: 0.7,
  },
  sourceNote: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  scheduleList: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 2,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
