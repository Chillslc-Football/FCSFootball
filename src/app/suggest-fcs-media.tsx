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

import { getAllConferenceMetadata } from '@/data/conferences/conferenceList';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { submitMediaSuggestion } from '@/data/mediaDirectory/mediaSuggestionsApi';
import {
  MONTANA_ESPN_TEAM_ID,
  MONTANA_STATE_ESPN_TEAM_ID,
  MONTANA_STATE_TEAM_NAME,
  MONTANA_TEAM_NAME,
  type MediaSuggestionProvider,
} from '@/data/mediaDirectory/types';
import { colors, spacing, typography } from '@/theme';

const PROVIDERS: { id: MediaSuggestionProvider; label: string }[] = [
  { id: 'spotify', label: 'Spotify' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
];

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export default function SuggestFcsMediaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favorites } = useFavoriteTeams();

  const [provider, setProvider] = useState<MediaSuggestionProvider | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [isNational, setIsNational] = useState(false);
  const [conferenceIds, setConferenceIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fcsConferences = useMemo(
    () =>
      getAllConferenceMetadata()
        .filter((conference) => conference.division === 'fcs')
        .map((conference) => ({ id: conference.id, label: conference.displayName })),
    [],
  );

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    map.set(MONTANA_STATE_ESPN_TEAM_ID, MONTANA_STATE_TEAM_NAME);
    map.set(MONTANA_ESPN_TEAM_ID, MONTANA_TEAM_NAME);
    for (const favorite of favorites) {
      const id = favorite.espnTeamId ?? favorite.key;
      if (id) map.set(id, favorite.name);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [favorites]);

  function resetForm() {
    setProvider(null);
    setSubmittedUrl('');
    setIsNational(false);
    setConferenceIds([]);
    setTeamIds([]);
    setNotes('');
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await submitMediaSuggestion({
        provider: provider ?? undefined,
        submittedUrl,
        isNational,
        conferenceIds,
        teamIds,
        notes,
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

        <Text style={styles.label}>Coverage</Text>
        <Text style={styles.help}>
          Choose National FCS, one or more conferences, one or more teams, or any combination.
        </Text>
        <View style={styles.chipRow}>
          <Chip
            label="National FCS"
            selected={isNational}
            onPress={() => setIsNational((value) => !value)}
          />
        </View>

        <Text style={styles.label}>Conferences</Text>
        <View style={styles.chipRow}>
          {fcsConferences.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={conferenceIds.includes(option.id)}
              onPress={() => setConferenceIds((ids) => toggleId(ids, option.id))}
            />
          ))}
        </View>

        <Text style={styles.label}>Teams</Text>
        <View style={styles.chipRow}>
          {teamOptions.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={teamIds.includes(option.id)}
              onPress={() => setTeamIds((ids) => toggleId(ids, option.id))}
            />
          ))}
        </View>

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
  help: { ...typography.caption, color: colors.textSecondary },
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
