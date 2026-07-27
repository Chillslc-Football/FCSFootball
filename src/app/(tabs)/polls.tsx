import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Top25TeamCard } from '@/components/Top25TeamCard';
import { logPollRefreshDev } from '@/data/polls/pollRefreshLog';
import {
  buildPollMetadataLines,
  decidePollFetch,
  loadCachedPollPayload,
  loadPollRefreshMeta,
  recordAutomaticPollCheckAttempt,
  recordSuccessfulPollCheck,
  saveBootstrapPollPayload,
  type PollRefreshMeta,
} from '@/data/polls/pollWeekRefresh';
import {
  getStaticNcaaRankingsPayload,
  ncaaRankingsProvider,
} from '@/data/providers/ncaaRankingsProvider';
import { espnScoresProvider } from '@/data/providers/espnProvider';
import { logEspnRefreshDev } from '@/data/providers/espnRefreshLog';
import {
  buildTeamLogoLookup,
  lookupTeamLogo,
  type TeamLogoInfo,
} from '@/data/providers/teamLogoLookup';
import { registerEspnGames } from '@/data/teams/teamGamesStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, spacing } from '@/theme';
import type { NcaaRankingsPayload } from '@/types';

export default function PollsScreen() {
  const [payload, setPayload] = useState<NcaaRankingsPayload | null>(null);
  const [refreshMeta, setRefreshMeta] = useState<PollRefreshMeta | null>(null);
  const [logoLookup, setLogoLookup] = useState<Map<string, TeamLogoInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const payloadRef = useRef<NcaaRankingsPayload | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const hydratedRef = useRef(false);

  payloadRef.current = payload;

  const loadPolls = useCallback(async (options?: {
    pullRefresh?: boolean;
    forcePoll?: boolean;
    trigger?: string;
  }) => {
    if (inFlightRef.current && !options?.pullRefresh) {
      return inFlightRef.current;
    }

    const pullRefresh = options?.pullRefresh ?? false;
    const trigger = options?.trigger ?? (pullRefresh ? 'polls-ptr' : 'polls-focus');
    const isAutomatic = !pullRefresh && !options?.forcePoll;

    const run = (async () => {
      if (!pullRefresh && !payloadRef.current) {
        setLoading(true);
      }

      // Hydrate last successful poll immediately (session or AsyncStorage).
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        const [cached, meta] = await Promise.all([
          loadCachedPollPayload(),
          loadPollRefreshMeta(),
        ]);
        if (meta) setRefreshMeta(meta);
        if (!payloadRef.current && cached?.teams?.length) {
          setPayload(cached);
          payloadRef.current = cached;
        }
      }

      const decision = await decidePollFetch({
        force: pullRefresh || options?.forcePoll,
        hasSavedPoll: Boolean(payloadRef.current?.teams?.length),
      });

      logPollRefreshDev({
        pollSource: 'Stats Perform FCS Top 25',
        fetchTrigger: trigger,
        decisionReason: decision.reason,
        expectedCycleId: decision.pollWeekId,
        hourlyRetryBlocked: decision.hourlyRetryBlocked,
        suppliedBy: payloadRef.current?.suppliedBy ?? 'cache',
        pollWeekReturned: payloadRef.current?.week,
        officialPublicationDate: payloadRef.current?.officialPublishedAt,
        note: decision.needed ? 'live-request' : 'skipped',
      });

      logEspnRefreshDev({
        source: 'Polls',
        screen: 'Polls',
        trigger,
        phase: decision.needed ? 'start' : 'skip',
        scheduledPollNeeded: decision.needed,
        pollWeekId: decision.pollWeekId,
        note: decision.reason,
      });

      try {
        if (decision.needed) {
          if (isAutomatic) {
            const attempted = await recordAutomaticPollCheckAttempt();
            setRefreshMeta(attempted);
          }

          try {
            const rankingsResponse = await ncaaRankingsProvider.getTop25({ forceRefresh: true });
            const incoming = rankingsResponse.data;
            const previous = payloadRef.current;
            const { meta, isNew } = await recordSuccessfulPollCheck({
              payload: incoming,
              previous,
              cycleId: decision.pollWeekId,
              isAutomatic,
            });
            setRefreshMeta(meta);

            if (isNew || !previous?.teams?.length) {
              setPayload(incoming);
              payloadRef.current = incoming;
            }

            logPollRefreshDev({
              pollSource: 'Stats Perform FCS Top 25',
              fetchTrigger: trigger,
              pollWeekReturned: incoming.week,
              officialPublicationDate: incoming.officialPublishedAt,
              isNewPoll: isNew,
              hourlyRetryBlocked: false,
              suppliedBy: incoming.suppliedBy ?? null,
              decisionReason: decision.reason,
              expectedCycleId: decision.pollWeekId,
              note: isNew ? 'saved-new-poll' : 'unchanged-retained',
            });

            logEspnRefreshDev({
              source: 'Polls',
              screen: 'Polls',
              trigger,
              phase: 'success',
              count: incoming.teams.length,
              pollWeekId: decision.pollWeekId,
              scheduledPollNeeded: true,
              note: isNew ? 'new-poll' : 'unchanged',
            });
          } catch (liveError) {
            // Keep last successful rankings/metadata. Bootstrap static only if empty.
            if (!payloadRef.current?.teams?.length) {
              const bootstrap = getStaticNcaaRankingsPayload();
              const meta = await saveBootstrapPollPayload(bootstrap);
              setPayload(bootstrap);
              payloadRef.current = bootstrap;
              setRefreshMeta(meta);
              logPollRefreshDev({
                pollSource: 'Stats Perform FCS Top 25',
                fetchTrigger: trigger,
                pollWeekReturned: bootstrap.week,
                officialPublicationDate: bootstrap.officialPublishedAt,
                isNewPoll: true,
                suppliedBy: 'static-fallback',
                decisionReason: decision.reason,
                expectedCycleId: decision.pollWeekId,
                note: 'live-failed-static-bootstrap',
                error: liveError,
              });
            } else {
              logPollRefreshDev({
                pollSource: 'Stats Perform FCS Top 25',
                fetchTrigger: trigger,
                pollWeekReturned: payloadRef.current?.week,
                officialPublicationDate: payloadRef.current?.officialPublishedAt,
                isNewPoll: false,
                suppliedBy: payloadRef.current?.suppliedBy ?? 'cache',
                decisionReason: decision.reason,
                expectedCycleId: decision.pollWeekId,
                note: 'live-failed-kept-cache',
                error: liveError,
              });
              console.warn(
                '[PollsScreen] live poll failed; keeping last successful poll:',
                liveError,
              );
            }
          }
        }

        // ESPN logos always force-refresh on open/focus/PTR (separate from weekly poll gate).
        logEspnRefreshDev({
          source: 'ESPN',
          screen: 'Polls',
          trigger: `${trigger}-logos`,
          phase: 'start',
        });
        const espnResponse = await espnScoresProvider
          .getWeekGames('week-1', { forceRefresh: true })
          .catch((error) => {
            logEspnRefreshDev({
              source: 'ESPN',
              screen: 'Polls',
              trigger: `${trigger}-logos`,
              phase: 'error',
              error,
            });
            return null;
          });

        if (espnResponse) {
          setLogoLookup(buildTeamLogoLookup(espnResponse.data.games));
          registerEspnGames(espnResponse.data.games);
          logEspnRefreshDev({
            source: 'ESPN',
            screen: 'Polls',
            trigger: `${trigger}-logos`,
            phase: 'success',
            count: espnResponse.data.games.length,
          });
        }
      } catch (error) {
        logEspnRefreshDev({
          source: 'Polls',
          screen: 'Polls',
          trigger,
          phase: 'error',
          error,
          pollWeekId: decision.pollWeekId,
          scheduledPollNeeded: decision.needed,
        });
        console.warn('[PollsScreen] load failed; keeping last successful poll when available:', error);
      } finally {
        setLoading(false);
      }
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightRef.current === run) inFlightRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPolls({ trigger: 'polls-focus' });

      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          void loadPolls({ trigger: 'polls-app-active' });
        }
      });

      return () => {
        subscription.remove();
      };
    }, [loadPolls]),
  );

  const { refreshing, onPullToRefresh } = usePullToRefresh(
    useCallback(async () => {
      await loadPolls({ pullRefresh: true, forcePoll: true, trigger: 'polls-ptr' });
    }, [loadPolls]),
  );

  const teamsWithLogos = useMemo(() => {
    if (!payload) return [];

    return payload.teams.map((item) => {
      const logoInfo = lookupTeamLogo(item.team.name, logoLookup);
      return {
        item,
        logoUrl: logoInfo?.logoUrl,
        espnTeamId: logoInfo?.teamId,
        abbreviation: logoInfo?.abbreviation,
      };
    });
  }, [payload, logoLookup]);

  const metadata = useMemo(
    () => buildPollMetadataLines(payload, refreshMeta),
    [payload, refreshMeta],
  );

  const subtitle = useMemo(() => {
    const lines = [metadata.weekLabel, metadata.dateLabel].filter(Boolean);
    return lines.length > 0 ? lines.join('\n') : undefined;
  }, [metadata.weekLabel, metadata.dateLabel]);

  return (
    <Screen
      denseTop
      title={metadata.pollName}
      subtitle={subtitle}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onPullToRefresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }>
      {loading && !payload ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {payload ? (
        <View style={styles.list}>
          {teamsWithLogos.map(({ item, logoUrl, espnTeamId, abbreviation }) => (
            <Top25TeamCard
              key={`${item.rank}-${item.team.id}`}
              item={item}
              logoUrl={logoUrl}
              espnTeamId={espnTeamId}
              abbreviation={abbreviation}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  list: {
    gap: spacing.sm,
  },
});
