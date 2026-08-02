import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaBrowseFilterChips, MediaBrowseSheet } from '@/components/media/MediaBrowseSheet';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { resolveSuggestCoverageFromParams } from '@/data/mediaDirectory/contextualMedia';
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
import {
  createEmptyMediaLinkRow,
  type MediaLinkRowInput,
} from '@/data/mediaDirectory/mediaLinkRows';
import {
  MEDIA_PLATFORM_LINK_KEYS,
  MEDIA_PLATFORM_LINK_LABELS,
  MEDIA_PLATFORM_LINK_PLACEHOLDERS,
  type MediaPlatformLinkKey,
} from '@/data/mediaDirectory/mediaPlatformLinks';
import { buildMediaSuggestionCoverageLabels } from '@/data/mediaDirectory/mediaSuggestionCoverageLabels';
import { submitMediaSuggestion } from '@/data/mediaDirectory/mediaSuggestionsApi';
import type { MediaSuggestionFieldErrors } from '@/data/mediaDirectory/mediaSourceValidation';
import {
  MONTANA_ESPN_TEAM_ID,
  MONTANA_STATE_ESPN_TEAM_ID,
  MONTANA_STATE_TEAM_NAME,
  MONTANA_TEAM_NAME,
} from '@/data/mediaDirectory/types';
import { debugLogSupabaseConfig } from '@/data/notifications/supabaseClient';
import { getAllCachedEspnGames } from '@/data/teams/teamGamesStore';
import { colors, spacing, typography } from '@/theme';

/** Extra space above the keyboard so the field + validation stay visible. */
const FOCUS_SCROLL_EXTRA = 140;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

function scrollFocusedInputIntoView(
  scrollRef: React.RefObject<ScrollView | null>,
  target: Parameters<typeof findNodeHandle>[0] | null | undefined,
) {
  if (!target || !scrollRef.current) return;
  const nodeHandle = findNodeHandle(target);
  if (nodeHandle == null) return;

  const delay = Platform.OS === 'ios' ? 60 : 160;
  setTimeout(() => {
    const scrollView = scrollRef.current as unknown as {
      getScrollResponder?: () => {
        scrollResponderScrollNativeHandleToKeyboard?: (
          nodeHandle: number,
          additionalOffset: number,
          preventNegativeScrollOffset: boolean,
        ) => void;
      };
    } | null;
    scrollView
      ?.getScrollResponder?.()
      ?.scrollResponderScrollNativeHandleToKeyboard?.(nodeHandle, FOCUS_SCROLL_EXTRA, true);
  }, delay);
}

export default function SuggestFcsMediaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    teamId?: string | string[];
    teamName?: string | string[];
    conferenceId?: string | string[];
    conferenceName?: string | string[];
  }>();
  const { favorites } = useFavoriteTeams();
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const linkLabelRefs = useRef<Array<TextInput | null>>([]);
  const linkUrlRefs = useRef<Array<TextInput | null>>([]);

  const [name, setName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [linkRows, setLinkRows] = useState<MediaLinkRowInput[]>([createEmptyMediaLinkRow(0)]);
  // Seed coverage once from validated route params; user can edit/remove chips freely.
  const [coverage, setCoverage] = useState<MediaBrowseFilter>(() =>
    resolveSuggestCoverageFromParams({
      teamId: firstParam(params.teamId),
      teamName: firstParam(params.teamName),
      conferenceId: firstParam(params.conferenceId),
      conferenceName: firstParam(params.conferenceName),
    }),
  );
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MediaSuggestionFieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    debugLogSupabaseConfig('SuggestFcsMediaScreen.mount');
  }, []);

  const conferences = useMemo(() => getMediaBrowseConferenceOptions(), []);

  const teams = useMemo((): MediaBrowseTeamOption[] => {
    const byId = new Map<string, string>();
    byId.set(MONTANA_STATE_ESPN_TEAM_ID, MONTANA_STATE_TEAM_NAME);
    byId.set(MONTANA_ESPN_TEAM_ID, MONTANA_TEAM_NAME);
    for (const favorite of favorites) {
      const id = (favorite.espnTeamId ?? favorite.key)?.trim();
      const favoriteName = favorite.name?.trim();
      if (id && favoriteName && !byId.has(id)) byId.set(id, favoriteName);
    }
    for (const team of buildMediaBrowseTeamOptions([], getAllCachedEspnGames())) {
      if (!byId.has(team.id)) byId.set(team.id, team.name);
    }
    return [...byId.entries()]
      .map(([id, teamName]) => ({ id, name: teamName }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [favorites, coverageOpen]);

  const coverageChips = useMemo(() => getMediaBrowseChips(coverage), [coverage]);

  const bottomPadding =
    Math.max(insets.bottom, spacing.xxl) +
    spacing.xl +
    (keyboardHeight > 0 ? Math.max(keyboardHeight * 0.35, spacing.xxl) : spacing.xxl);

  function onInputFocus(event: { target?: unknown }) {
    const target = event.target as Parameters<typeof findNodeHandle>[0] | null | undefined;
    scrollFocusedInputIntoView(scrollRef, target);
  }

  function updateLinkRow(index: number, patch: Partial<MediaLinkRowInput>) {
    setLinkRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.links;
      delete next[`links.${index}.url`];
      delete next[`links.${index}.platform`];
      return next;
    });
  }

  function addLinkRow() {
    setLinkRows((current) => [...current, createEmptyMediaLinkRow(current.length)]);
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
        const nextIndex = linkRows.length;
        linkUrlRefs.current[nextIndex]?.focus();
      }, Platform.OS === 'ios' ? 80 : 120);
    });
  }

  function removeLinkRow(index: number) {
    setLinkRows((current) => {
      if (current.length <= 1) {
        return [createEmptyMediaLinkRow(0)];
      }
      return current
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row, sortOrder) => ({ ...row, sortOrder }));
    });
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.links;
      return next;
    });
  }

  function resetForm() {
    setName('');
    setSubmitterEmail('');
    setLinkRows([createEmptyMediaLinkRow(0)]);
    setCoverage(createEmptyMediaBrowseFilter());
    setNotes('');
    setFieldErrors({});
  }

  async function handleSubmit() {
    if (submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});
    try {
      const mapped = mediaBrowseFilterToCoverage(coverage);
      const result = await submitMediaSuggestion({
        name,
        submitterEmail,
        linkRows,
        isNational: mapped.isNational,
        conferenceIds: mapped.conferenceIds,
        teamIds: mapped.teamIds,
        notes: notes.trim() || null,
        coverageLabel: formatMediaBrowseCoverageLabel(coverage) || undefined,
        coverageLabels: buildMediaSuggestionCoverageLabels(coverage),
      });
      if (!result.ok) {
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
          setFieldErrors(result.fieldErrors);
        }
        if (result.error?.trim()) {
          setErrorMessage(result.error.trim());
        }
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
      <SafeAreaView style={styles.flex} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
          <ScrollView
            ref={scrollRef}
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator>
            <Text style={styles.heading}>Suggest FCS Media</Text>

            <Text style={styles.label}>Creator or Podcast Name</Text>
            <TextInput
              ref={nameRef}
              value={name}
              onFocus={onInputFocus}
              onChangeText={(value) => {
                setName(value);
                setFieldErrors((current) => {
                  if (!current.name) return current;
                  const next = { ...current };
                  delete next.name;
                  return next;
                });
              }}
              placeholder="e.g. Bobcat Insider Podcast"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
              style={styles.input}
            />
            {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}

            <Text style={styles.label}>Your Email</Text>
            <Text style={styles.hint}>
              Used only if we need clarification about your suggestion.
            </Text>
            <TextInput
              ref={emailRef}
              value={submitterEmail}
              onFocus={onInputFocus}
              onChangeText={(value) => {
                setSubmitterEmail(value);
                setFieldErrors((current) => {
                  if (!current.submitterEmail) return current;
                  const next = { ...current };
                  delete next.submitterEmail;
                  return next;
                });
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                const label = linkLabelRefs.current[0];
                if (label) label.focus();
                else linkUrlRefs.current[0]?.focus();
              }}
              style={styles.input}
            />
            {fieldErrors.submitterEmail ? (
              <Text style={styles.fieldError}>{fieldErrors.submitterEmail}</Text>
            ) : null}

            <Text style={styles.label}>Platform Links</Text>
            <Text style={styles.hint}>
              Add at least one link. You can add multiple YouTube, Spotify, or other links.
            </Text>

            {linkRows.map((row, index) => (
              <View key={`link-${index}`} style={styles.linkCard}>
                <View style={styles.linkCardHeader}>
                  <Text style={styles.linkLabel}>Link {index + 1}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove link ${index + 1}`}
                    onPress={() => removeLinkRow(index)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.removeLink, pressed && styles.pressed]}>
                    <Text style={styles.removeLinkText}>Remove</Text>
                  </Pressable>
                </View>

                <Text style={styles.linkLabel}>Platform</Text>
                <View style={styles.platformChips}>
                  {MEDIA_PLATFORM_LINK_KEYS.map((key) => {
                    const selected = (row.platform || 'website') === key;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => updateLinkRow(index, { platform: key })}
                        style={({ pressed }) => [
                          styles.platformChip,
                          selected && styles.platformChipOn,
                          pressed && styles.pressed,
                        ]}>
                        <Text
                          style={[
                            styles.platformChipText,
                            selected && styles.platformChipTextOn,
                          ]}>
                          {MEDIA_PLATFORM_LINK_LABELS[key]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {fieldErrors[`links.${index}.platform`] ? (
                  <Text style={styles.fieldError}>{fieldErrors[`links.${index}.platform`]}</Text>
                ) : null}

                <Text style={styles.linkLabel}>Label (optional)</Text>
                <TextInput
                  ref={(node) => {
                    linkLabelRefs.current[index] = node;
                  }}
                  value={row.label ?? ''}
                  onFocus={onInputFocus}
                  onChangeText={(value) => updateLinkRow(index, { label: value })}
                  placeholder="e.g. Main Channel"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => linkUrlRefs.current[index]?.focus()}
                  style={styles.input}
                />

                <Text style={styles.linkLabel}>URL</Text>
                <TextInput
                  ref={(node) => {
                    linkUrlRefs.current[index] = node;
                  }}
                  value={row.url ?? ''}
                  onFocus={onInputFocus}
                  onChangeText={(value) => updateLinkRow(index, { url: value })}
                  placeholder={
                    MEDIA_PLATFORM_LINK_PLACEHOLDERS[
                      ((row.platform || 'website') as MediaPlatformLinkKey)
                    ]
                  }
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType={index === linkRows.length - 1 ? 'next' : 'next'}
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (index < linkRows.length - 1) {
                      linkLabelRefs.current[index + 1]?.focus();
                      return;
                    }
                    notesRef.current?.focus();
                  }}
                  style={styles.input}
                />
                {fieldErrors[`links.${index}.url`] ? (
                  <Text style={styles.fieldError}>{fieldErrors[`links.${index}.url`]}</Text>
                ) : null}
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another link"
              onPress={addLinkRow}
              style={({ pressed }) => [styles.addLinkButton, pressed && styles.pressed]}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addLinkText}>Add Another Link</Text>
            </Pressable>
            {fieldErrors.links ? <Text style={styles.fieldError}>{fieldErrors.links}</Text> : null}

            <Text style={styles.label}>Coverage Tags</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select coverage tags"
              onPress={() => {
                Keyboard.dismiss();
                setCoverageOpen(true);
              }}
              style={({ pressed }) => [styles.coverageTrigger, pressed && styles.pressed]}>
              <Text style={styles.coverageTriggerText}>Select coverage</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {coverageChips.length > 0 ? (
              <MediaBrowseFilterChips
                chips={coverageChips}
                onRemove={(chip) => {
                  setCoverage((current) => removeMediaBrowseChip(current, chip));
                  setFieldErrors((current) => {
                    if (!current.coverage) return current;
                    const next = { ...current };
                    delete next.coverage;
                    return next;
                  });
                }}
              />
            ) : (
              <Text style={styles.hint}>Choose at least one coverage tag</Text>
            )}
            {fieldErrors.coverage ? (
              <Text style={styles.fieldError}>{fieldErrors.coverage}</Text>
            ) : null}

            <Text style={styles.label}>Notes</Text>
            <TextInput
              ref={notesRef}
              value={notes}
              onFocus={onInputFocus}
              onChangeText={setNotes}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              multiline
              returnKeyType="default"
              blurOnSubmit={false}
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

            {keyboardHeight > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss keyboard"
                onPress={Keyboard.dismiss}
                style={({ pressed }) => [styles.dismissKeyboard, pressed && styles.pressed]}>
                <Text style={styles.dismissKeyboardText}>Done</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  heading: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600', marginTop: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted },
  linkCard: {
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  linkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  removeLink: { paddingVertical: 4, paddingHorizontal: 4 },
  removeLinkText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  platformChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  platformChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
  },
  platformChipOn: { borderColor: colors.primary },
  platformChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  platformChipTextOn: { color: colors.primary },
  addLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    marginTop: spacing.xs,
  },
  addLinkText: { ...typography.body, fontWeight: '600', color: colors.primary },
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
  dismissKeyboard: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dismissKeyboardText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  pressed: { opacity: 0.85 },
  fieldError: { ...typography.caption, color: colors.error },
  error: { ...typography.caption, color: colors.error },
  success: { ...typography.caption, color: colors.primary },
});
