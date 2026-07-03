import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamLogo } from '@/components/TeamLogo';
import { TodayGameCard } from '@/components/TodayGameCard';
import {
  loadTeamSeasonData,
  TEAM_SCHEDULE_SOURCE_NOTE,
  type TeamProfile,
} from '@/data/teams/loadTeamSeasonGames';
import { colors, spacing, typography } from '@/theme';
import { getTeamDetailHeading } from '@/utils/teamDisplay';
import type { EspnNormalizedGame } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

function TeamHeader({ profile }: { profile: TeamProfile }) {
  const heading = getTeamDetailHeading({
    displayName: profile.displayName,
    location: profile.location,
    mascot: profile.mascot,
  });

  return (
    <View style={styles.headerCard}>
      <TeamLogo
        name={profile.displayName}
        abbreviation={profile.abbreviation}
        logoUrl={profile.logoUrl}
        size="featured"
      />
      <View style={styles.headerInfo}>
        <View style={styles.nameRow}>
          {profile.rank != null ? (
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>#{profile.rank}</Text>
            </View>
          ) : null}
          <Text style={styles.teamName}>{heading.title}</Text>
        </View>
        {heading.mascot ? (
          <Text style={styles.metaText}>{heading.mascot}</Text>
        ) : null}
        {profile.abbreviation ? (
          <Text style={styles.metaText}>{profile.abbreviation}</Text>
        ) : null}
        {profile.conference ? (
          <Text style={styles.metaText}>{profile.conference}</Text>
        ) : null}
        {profile.record ? (
          <Text style={styles.metaText}>Record: {profile.record}</Text>
        ) : null}
      </View>
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) {
      setLoadState('error');
      setErrorMessage('Team not found.');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadState('loading');
      setErrorMessage(null);

      try {
        const data = await loadTeamSeasonData(routeId);
        if (cancelled) return;
        setProfile(data.profile);
        setGames(data.games);
        setLoadState('success');
      } catch (err) {
        if (cancelled) return;
        setProfile(null);
        setGames([]);
        setErrorMessage(err instanceof Error ? err.message : 'Could not load team data.');
        setLoadState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const screenTitle = profile?.displayName ?? profile?.name ?? 'Team';

  return (
    <>
      <Stack.Screen options={{ title: screenTitle, headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.xxl) },
        ]}
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
            <TeamHeader profile={profile} />

            <Text style={styles.sourceNote}>{TEAM_SCHEDULE_SOURCE_NOTE}</Text>

            <Text style={styles.sectionTitle}>Season schedule & results</Text>

            {games.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No games found for {profile.name}.</Text>
                <Text style={styles.emptyText}>
                  Games appear here when ESPN scoreboard data includes this team for loaded weeks.
                </Text>
              </View>
            ) : (
              <View style={styles.gameList}>
                {games.map((game) => (
                  <TodayGameCard key={game.id} game={game} />
                ))}
              </View>
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
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
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
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    color: colors.background,
    fontSize: 9,
  },
  teamName: {
    ...typography.title,
    color: colors.text,
    flexShrink: 1,
  },
  metaText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sourceNote: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  gameList: {
    gap: spacing.sm,
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
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
