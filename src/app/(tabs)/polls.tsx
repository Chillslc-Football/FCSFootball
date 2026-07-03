import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ManualRankingsBanner } from '@/components/ManualRankingsBanner';
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
import { colors, spacing } from '@/theme';
import type { NcaaRankingsPayload } from '@/types';

export default function PollsScreen() {
  const [payload, setPayload] = useState<NcaaRankingsPayload | null>(null);
  const [logoLookup, setLogoLookup] = useState<Map<string, TeamLogoInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPolls() {
      setLoading(true);

      try {
        const [rankingsResponse, espnResponse] = await Promise.all([
          ncaaRankingsProvider.getTop25(),
          espnScoresProvider.getWeekGames('week-1').catch(() => null),
        ]);

        if (cancelled) return;

        setPayload(rankingsResponse.data);

        if (espnResponse) {
          setLogoLookup(buildTeamLogoLookup(espnResponse.data.games));
          registerEspnGames(espnResponse.data.games);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPolls();

    return () => {
      cancelled = true;
    };
  }, []);

  const teamsWithLogos = useMemo(() => {
    if (!payload) return [];

    return payload.teams.map((item) => ({
      item,
      logoUrl: lookupTeamLogo(item.team.name, logoLookup)?.logoUrl,
      espnTeamId: lookupTeamLogo(item.team.name, logoLookup)?.teamId,
    }));
  }, [payload, logoLookup]);

  return (
    <Screen title="Polls" subtitle="Official Stats Perform FCS Top 25 poll.">
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {payload ? (
        <>
          <ManualRankingsBanner
            pollName={payload.pollName}
            updatedLabel={payload.updatedLabel}
            updatedAt={payload.updatedAt ?? payload.updatedLabel}
          />

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
        </>
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
