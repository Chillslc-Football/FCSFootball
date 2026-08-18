import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { FavoriteStar } from '@/components/FavoriteStar';
import { TeamLogo } from '@/components/TeamLogo';
import type { ConferenceId } from '@/data/conferences/conferenceList';
import { sortConferenceStandingsByFavorites } from '@/data/conferences/sortConferenceStandingsByFavorites';
import { useConferenceStandings } from '@/data/conferences/useConferenceStandings';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { colors, spacing, STANDINGS_COLUMN_WIDTHS, typography } from '@/theme';
import { buildTeamHref } from '@/utils/teamId';
import type { ConferenceStandingEntry } from '@/types';

type ConferenceStandingsSectionProps = {
  conferenceId: ConferenceId;
  standings: ReturnType<typeof useConferenceStandings>;
};

function StandingsHeaderRow() {
  return (
    <View style={[styles.row, styles.headerRow]}>
      <View style={styles.teamCol}>
        <Text style={[styles.headerLabel, styles.teamHeaderLabel]} numberOfLines={1}>
          TEAM
        </Text>
      </View>
      <View style={styles.confCol}>
        <Text style={styles.headerLabel} numberOfLines={1}>
          CONF
        </Text>
      </View>
      <View style={styles.overallCol}>
        <Text style={styles.headerLabel} numberOfLines={1}>
          OVERALL
        </Text>
      </View>
    </View>
  );
}

export function ConferenceStandingsTableHeader() {
  return (
    <View style={styles.stickyTableHeader}>
      <StandingsHeaderRow />
    </View>
  );
}

function StandingsRow({ entry }: { entry: ConferenceStandingEntry }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${entry.displayName} team page`}
      onPress={() =>
        router.push(buildTeamHref({ teamId: entry.teamId, name: entry.displayName }))
      }
      style={({ pressed }) => [styles.row, styles.dataRow, pressed && styles.dataRowPressed]}>
      <View style={styles.teamCol}>
        <View style={styles.teamCell}>
          <TeamLogo
            name={entry.displayName}
            abbreviation={entry.abbreviation}
            logoUrl={entry.logoUrl}
            size={24}
          />
          <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail">
            {entry.shortDisplayName}
          </Text>
          <FavoriteStar
            teamId={entry.teamId}
            teamName={entry.displayName}
            abbreviation={entry.abbreviation}
            logoUrl={entry.logoUrl}
          />
        </View>
      </View>
      <View style={styles.confCol}>
        <Text style={styles.recordCell} numberOfLines={1}>
          {entry.conferenceRecord}
        </Text>
      </View>
      <View style={styles.overallCol}>
        <Text style={styles.recordCell} numberOfLines={1}>
          {entry.overallRecord}
        </Text>
      </View>
    </Pressable>
  );
}

export function ConferenceStandingsSection({
  conferenceId: _conferenceId,
  standings,
}: ConferenceStandingsSectionProps) {
  const { isFavorite, favorites } = useFavoriteTeams();
  const { loadState, entries, unavailable, errorMessage } = standings;

  const sortedEntries = useMemo(
    () => sortConferenceStandingsByFavorites(entries, isFavorite),
    [entries, isFavorite, favorites],
  );

  if (loadState === 'loading') {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading standings…</Text>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>Could not load standings</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (unavailable || entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Standings are not available for this conference.</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <StandingsHeaderRow />
      {sortedEntries.map((entry, index) => (
        <View
          key={entry.teamId ?? `${entry.displayName}-${index}`}
          style={index < sortedEntries.length - 1 ? styles.rowDivider : undefined}>
          <StandingsRow entry={entry} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
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
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  table: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stickyTableHeader: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  dataRow: {
    minHeight: 44,
  },
  dataRowPressed: {
    opacity: 0.75,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  teamCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  confCol: {
    width: STANDINGS_COLUMN_WIDTHS.conf,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
  },
  overallCol: {
    width: STANDINGS_COLUMN_WIDTHS.overall,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
  },
  headerLabel: {
    ...typography.label,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.textMuted,
    textAlign: 'center',
    width: '100%',
  },
  teamHeaderLabel: {
    textAlign: 'left',
  },
  teamCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  teamName: {
    flexGrow: 1,
    flexShrink: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    minWidth: 0,
  },
  recordCell: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    width: '100%',
  },
});
