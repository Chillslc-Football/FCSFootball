import * as Linking from 'expo-linking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAllConferenceMetadata } from '@/data/conferences/conferenceList';
import { checkIsAppAdmin } from '@/data/media/mediaAdminApi';
import { useAdminAuth } from '@/data/media/useAdminAuth';
import {
  resolveConferenceBadgeLabel,
  resolveTeamBadgeLabel,
} from '@/data/mediaDirectory/mediaScopeBadge';
import {
  adminListMediaSuggestions,
  adminReviewMediaSuggestion,
} from '@/data/mediaDirectory/mediaSuggestionsApi';
import {
  MONTANA_ESPN_TEAM_ID,
  MONTANA_STATE_ESPN_TEAM_ID,
  MONTANA_STATE_TEAM_NAME,
  MONTANA_TEAM_NAME,
  type MediaSuggestion,
} from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

type DraftCoverage = {
  isNational: boolean;
  conferenceIds: string[];
  teamIds: string[];
};

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function formatTeamList(ids: string[]): string {
  if (ids.length === 0) return 'None';
  return ids.map((id) => resolveTeamBadgeLabel(id) ?? 'Team').join(', ');
}

function formatConferenceList(ids: string[]): string {
  if (ids.length === 0) return 'None';
  return ids.map((id) => resolveConferenceBadgeLabel(id) ?? 'Conference').join(', ');
}

export default function DeveloperMediaSuggestionsScreen() {
  const auth = useAdminAuth();
  const [rows, setRows] = useState<MediaSuggestion[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftCoverage>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fcsConferences = useMemo(
    () =>
      getAllConferenceMetadata()
        .filter((conference) => conference.division === 'fcs')
        .map((conference) => ({ id: conference.id, label: conference.displayName })),
    [],
  );

  const teamOptions = useMemo(
    () => [
      { id: MONTANA_STATE_ESPN_TEAM_ID, label: MONTANA_STATE_TEAM_NAME },
      { id: MONTANA_ESPN_TEAM_ID, label: MONTANA_TEAM_NAME },
    ],
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isAdmin = auth.isAdmin || (await checkIsAppAdmin());
      if (!isAdmin) {
        setRows([]);
        setDrafts({});
        setError('Sign in as an allowlisted administrator to review suggestions.');
        return;
      }
      const data = await adminListMediaSuggestions('pending');
      setRows(data);
      const nextDrafts: Record<string, DraftCoverage> = {};
      for (const row of data) {
        nextDrafts[row.id] = {
          isNational: row.isNational,
          conferenceIds: [...row.conferenceIds],
          teamIds: [...row.teamIds],
        };
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [auth.isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(id: string, patch: Partial<DraftCoverage>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        isNational: current[id]?.isNational ?? false,
        conferenceIds: current[id]?.conferenceIds ?? [],
        teamIds: current[id]?.teamIds ?? [],
        ...patch,
      },
    }));
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    setError(null);
    try {
      const draft = drafts[id];
      if (status === 'approved' && draft) {
        if (!draft.isNational && draft.conferenceIds.length === 0 && draft.teamIds.length === 0) {
          setError('Assign National, a conference, or a team before approving.');
          return;
        }
        await adminReviewMediaSuggestion(id, status, draft);
      } else {
        await adminReviewMediaSuggestion(id, status);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }>
      <Text style={styles.help}>
        Pending media suggestions. Approving marks the suggestion reviewed and stores coverage —
        it does not auto-publish a finished media source. Add creator details in Supabase before
        publishing a public listing.
      </Text>

      {!auth.isAdmin ? (
        <Text style={styles.help}>
          Open /admin to sign in with an allowlisted account, then return here.
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && rows.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && rows.length === 0 && !error ? (
        <Text style={styles.empty}>No pending suggestions.</Text>
      ) : null}

      {rows.map((row) => {
        const draft = drafts[row.id] ?? {
          isNational: row.isNational,
          conferenceIds: row.conferenceIds,
          teamIds: row.teamIds,
        };

        return (
          <View key={row.id} style={styles.card}>
            <Text style={styles.title}>{row.provider.toUpperCase()}</Text>
            <Text style={styles.meta}>{row.submitted_url}</Text>
            <Text style={styles.meta}>National: {draft.isNational ? 'Yes' : 'No'}</Text>
            <Text style={styles.meta}>
              Conferences: {formatConferenceList(draft.conferenceIds)}
            </Text>
            <Text style={styles.meta}>Teams: {formatTeamList(draft.teamIds)}</Text>
            {row.notes ? <Text style={styles.meta}>Notes: {row.notes}</Text> : null}
            <Text style={styles.meta}>
              {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
            </Text>

            <Text style={styles.label}>Assign coverage</Text>
            <View style={styles.chipRow}>
              <Chip
                label="National FCS"
                selected={draft.isNational}
                onPress={() => updateDraft(row.id, { isNational: !draft.isNational })}
              />
            </View>
            <Text style={styles.label}>Conferences</Text>
            <View style={styles.chipRow}>
              {fcsConferences.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  selected={draft.conferenceIds.includes(option.id)}
                  onPress={() =>
                    updateDraft(row.id, {
                      conferenceIds: toggleId(draft.conferenceIds, option.id),
                    })
                  }
                />
              ))}
            </View>
            <Text style={styles.label}>Teams</Text>
            <View style={styles.chipRow}>
              {teamOptions.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  selected={draft.teamIds.includes(option.id)}
                  onPress={() =>
                    updateDraft(row.id, {
                      teamIds: toggleId(draft.teamIds, option.id),
                    })
                  }
                />
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void Linking.openURL(row.submitted_url)}>
                <Text style={styles.secondaryText}>Open Link</Text>
              </Pressable>
              <Pressable
                disabled={busyId === row.id}
                style={styles.button}
                onPress={() => void review(row.id, 'approved')}>
                <Text style={styles.buttonText}>Approve</Text>
              </Pressable>
              <Pressable
                disabled={busyId === row.id}
                style={styles.dangerButton}
                onPress={() => void review(row.id, 'rejected')}>
                <Text style={styles.buttonText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  help: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  error: { ...typography.caption, color: colors.error },
  empty: { ...typography.body, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { ...typography.body, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textSecondary },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.background, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dangerButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  buttonText: { ...typography.caption, color: colors.background, fontWeight: '700' },
  secondaryText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
