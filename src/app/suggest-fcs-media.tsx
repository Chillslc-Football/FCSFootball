import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaBrowseFilterChips, MediaBrowseSheet } from '@/components/media/MediaBrowseSheet';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import {
  buildMediaBrowseTeamOptions,
  createEmptyMediaBrowseFilter,
  formatMediaBrowseCoverageLabel,
  getMediaBrowseChips,
  getMediaBrowseConferenceOptions,
  mediaBrowseFilterToCoverage,
  removeMediaBrowseChip,
  type MediaBrowseFilter,
  type MediaBrowseTeamOption,
} from '@/data/mediaDirectory/mediaBrowse';
import { submitMediaSuggestion } from '@/data/mediaDirectory/mediaSuggestionsApi';
import {
  MONTANA_ESPN_TEAM_ID,
  MONTANA_STATE_ESPN_TEAM_ID,
  MONTANA_STATE_TEAM_NAME,
  MONTANA_TEAM_NAME,
  type MediaSuggestionProvider,
} from '@/data/mediaDirectory/types';
import { getAllCachedEspnGames } from '@/data/teams/teamGamesStore';
import { colors, spacing, typography } from '@/theme';

const PROVIDERS: { id: MediaSuggestionProvider; label: string }[] = [
  { id: 'spotify', label: 'Spotify' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
];

export default function SuggestFcsMediaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favorites } = useFavoriteTeams();

  const [provider, setProvider] = useState<MediaSuggestionProvider | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [coverage, setCoverage] = useState<MediaBrowseFilter>(createEmptyMediaBrowseFilter);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const conferences = useMemo(() => getMediaBrowseConferenceOptions(), []);

  const teams = useMemo((): MediaBrowseTeamOption[] => {
    const byId = new Map<string, string>();
    byId.set(MONTANA_STATE_ESPN_TEAM_ID, MONTANA_STATE_TEAM_NAME);
    byId.set(MONTANA_ESPN_TEAM_ID, MONTANA_TEAM_NAME);
    for (const favorite of favorites) {
      const id = (favorite.espnTeamId ?? favorite.key)?.trim();
      const name = favorite.name?.trim();
      if (id && name && !byId.has(id)) byId.set(id, name);
    }
    for (const team of buildMediaBrowseTeamOptions([], getAllCachedEspnGames())) {
      if (!byId.has(team.id)) byId.set(team.id, team.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [favorites, coverageOpen]);

  const coverageChips = useMemo(() => getMediaBrowseChips(coverage), [coverage]);

  function resetForm() {
    setProvider(null);
    setSubmittedUrl('');
    setCoverage(createEmptyMediaBrowseFilter());
    setNotes('');
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const mapped = mediaBrowseFilterToCoverage(coverage);
      const trimmedNotes = notes.trim() || null;
      const result = await submitMediaSuggestion({
        provider: provider ?? undefined,
        submittedUrl,
        isNational: mapped.isNational,
        conferenceIds: mapped.conferenceIds,
        teamIds: mapped.teamIds,
        notes: trimmedNotes,
        coverageLabel: formatMediaBrowseCoverageLabel(coverage) || undefined,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      resetForm();
      setSuccessMessage('Thanks. We’ll review it before publishing.');
      setTimeout(() => {
        router.back();
      }, 900);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Suggest FCS Media', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.xxl) },
        ]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Suggest FCS Media</Text>

        <Text style={styles.label}>What are you sharing?</Text>
        <View style={styles.chipRow}>
          {PROVIDERS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={provider === option.id}
              onPress={() => setProvider(option.id)}
            />
          ))}
        </View>

        <Text style={styles.label}>Link</Text>
        <TextInput
          value={submittedUrl}
          onChangeText={setSubmittedUrl}
          placeholder="https://"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
        />

        <Text style={styles.label}>Coverage Tags</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select coverage tags"
          onPress={() => setCoverageOpen(true)}
          style={({ pressed }) => [styles.coverageTrigger, pressed && styles.pressed]}>
          <Text style={styles.coverageTriggerText}>Select coverage</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {coverageChips.length > 0 ? (
          <MediaBrowseFilterChips
            chips={coverageChips}
            onRemove={(chip) => setCoverage((current) => removeMediaBrowseChip(current, chip))}
          />
        ) : (
          <Text style={styles.hint}>Choose at least one coverage tag</Text>
        )}

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.input, styles.inputMultiline]}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

        <Pressable
          disabled={submitting}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [
            styles.submitButton,
            (pressed || submitting) && styles.pressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.submitText}>Submit for Review</Text>
          )}
        </Pressable>

        <View style={styles.applePlaceholder}>
          <Text style={styles.appleTitle}>Apple Podcasts</Text>
          <Text style={styles.appleSub}>Coming with iPhone app</Text>
        </View>
      </ScrollView>

      <MediaBrowseSheet
        visible={coverageOpen}
        mode="coverage"
        activeFilter={coverage}
        teams={teams}
        conferences={conferences}
        onClose={() => setCoverageOpen(false)}
        onChangeFilter={setCoverage}
      />
    </>
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
  content: { padding: spacing.lg, gap: spacing.sm },
  heading: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.background, fontWeight: '700' },
  coverageTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  coverageTriggerText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  submitButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { ...typography.body, color: colors.background, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  error: { ...typography.caption, color: colors.error },
  success: { ...typography.caption, color: colors.primary },
  applePlaceholder: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.surface,
    opacity: 0.7,
  },
  appleTitle: { ...typography.body, color: colors.textMuted, fontWeight: '700' },
  appleSub: { ...typography.caption, color: colors.textMuted },
});
