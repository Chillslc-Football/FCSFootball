import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Top25TeamCard } from '@/components/Top25TeamCard';
import { ncaaRankingsProvider } from '@/data/providers/ncaaRankingsProvider';
import { espnScoresProvider } from '@/data/providers/espnProvider';
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
  const [logoLookup, setLogoLookup] = useState<Map<string, TeamLogoInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadPolls = useCallback(async (options?: { pullRefresh?: boolean }) => {
    if (!options?.pullRefresh) {
      setLoading(true);
    }

    try {
      const [rankingsResponse, espnResponse] = await Promise.all([
        ncaaRankingsProvider.getTop25(),
        espnScoresProvider.getWeekGames('week-1', { forceRefresh: options?.pullRefresh }).catch(() => null),
      ]);

      setPayload(rankingsResponse.data);

      if (espnResponse) {
        setLogoLookup(buildTeamLogoLookup(espnResponse.data.games));
        registerEspnGames(espnResponse.data.games);
      }
    } catch (error) {
      console.warn('[PollsScreen] load failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolls();
  }, [loadPolls]);

  const { refreshing, onPullToRefresh } = usePullToRefresh(
    useCallback(async () => {
      await loadPolls({ pullRefresh: true });
    }, [loadPolls]),
  );

  const teamsWithLogos = useMemo(() => {
    if (!payload) return [];

    return payload.teams.map((item) => ({
      item,
      logoUrl: lookupTeamLogo(item.team.name, logoLookup)?.logoUrl,
      espnTeamId: lookupTeamLogo(item.team.name, logoLookup)?.teamId,
    }));
  }, [payload, logoLookup]);

  return (
    <Screen
      denseTop
      subtitle="Official Stats Perform FCS Top 25 poll."
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
          {teamsWithLogos.map(({ item, logoUrl, espnTeamId }) => (
            <Top25TeamCard
              key={`${item.rank}-${item.team.id}`}
              item={item}
              logoUrl={logoUrl}
              espnTeamId={espnTeamId}
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
