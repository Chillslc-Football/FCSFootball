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
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DROPDOWN_CHEVRON_SIZE, dropdownStyles } from '@/components/dropdownStyles';
import { MediaBrowseSheet } from '@/components/media/MediaBrowseSheet';
import { MediaPlatformPicker } from '@/components/media/MediaPlatformPicker';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { resolveSuggestCoverageFromParams } from '@/data/mediaDirectory/contextualMedia';
import {
  buildMediaBrowseTeamOptions,
  cloneMediaBrowseFilter,
  createEmptyMediaBrowseFilter,
  formatCompactMediaBrowseCoverageSummary,
  formatMediaBrowseCoverageLabel,
  getMediaBrowseConferenceOptions,
  mediaBrowseFilterToCoverage,
  unionMediaBrowseFilters,
  type MediaBrowseFilter,
  type MediaBrowseTeamOption,
} from '@/data/mediaDirectory/mediaBrowse';
import {
  detectMediaPlatformFromUrl,
  getSuggestLinkUrlHostKey,
  normalizeSuggestLinkUrl,
} from '@/data/mediaDirectory/mediaLinkUrlDetection';
import {
  createEmptyMediaLinkRow,
  getMediaLinkRowBrowseFilter,
  isMediaPlatformLinkKey,
  type MediaLinkRowInput,
} from '@/data/mediaDirectory/mediaLinkRows';
import { type MediaPlatformLinkKey } from '@/data/mediaDirectory/mediaPlatformLinks';
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

function resolveLinkPlatform(platform: string | null | undefined): MediaPlatformLinkKey {
  const key = String(platform ?? '').trim().toLowerCase();
  return isMediaPlatformLinkKey(key) ? key : 'website';
}

const STICKY_SUBMIT_HEIGHT = 64;
const FOCUS_EDGE_PAD = 12;
const URL_PLACEHOLDER = 'youtube.com/@example';

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

function measureWindow(
  node: Parameters<typeof findNodeHandle>[0] | null | undefined,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  if (node == null) return Promise.resolve(null);
  const handle = findNodeHandle(node);
  if (handle == null) return Promise.resolve(null);
  return new Promise((resolve) => {
    UIManager.measureInWindow(handle, (x, y, width, height) => {
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number'
      ) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/**
 * Keep the focused field inside the ScrollView viewport (above sticky submit,
 * below the top edge) without the aggressive keyboard-native scroll that can
 * push multiline fields offscreen.
 */
async function ensureFocusedInputVisible(
  scrollRef: React.RefObject<ScrollView | null>,
  target: Parameters<typeof findNodeHandle>[0] | null | undefined,
  scrollY: number,
) {
  if (!target || !scrollRef.current) return;
  const [scrollBox, inputBox] = await Promise.all([
    measureWindow(scrollRef.current),
    measureWindow(target),
  ]);
  if (!scrollBox || !inputBox) return;

  const visibleTop = scrollBox.y + FOCUS_EDGE_PAD;
  const visibleBottom = scrollBox.y + scrollBox.height - FOCUS_EDGE_PAD;
  const inputTop = inputBox.y;
  const inputBottom = inputBox.y + inputBox.height;

  let delta = 0;
  if (inputBottom > visibleBottom) {
    delta = inputBottom - visibleBottom;
  } else if (inputTop < visibleTop) {
    delta = inputTop - visibleTop;
  }
  if (delta === 0) return;

  scrollRef.current.scrollTo({
    y: Math.max(0, scrollY + delta),
    animated: true,
  });
}

/** Normalize URL + apply auto platform unless a manual override is still sticky. */
function prepareLinkRowsForSubmit(rows: MediaLinkRowInput[]): MediaLinkRowInput[] {
  return rows.map((row) => {
    const url = normalizeSuggestLinkUrl(String(row.url ?? ''));
    const detected = detectMediaPlatformFromUrl(url);
    const host = getSuggestLinkUrlHostKey(url);
    const manualSticky =
      Boolean(row.platformManual) &&
      Boolean(row.platformManualHostKey) &&
      row.platformManualHostKey === host;

    let platform = resolveLinkPlatform(row.platform);
    if (detected && !manualSticky) {
      platform = detected;
    }
    return {
      ...row,
      url,
      platform,
      platformManual: manualSticky,
      platformManualHostKey: manualSticky ? host : null,
    };
  });
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
  const scrollYRef = useRef(0);
  const focusedInputRef = useRef<Parameters<typeof findNodeHandle>[0] | null>(null);
  const nameRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const linkLabelRefs = useRef<Array<TextInput | null>>([]);
  const linkUrlRefs = useRef<Array<TextInput | null>>([]);

  const initialCoverage = useMemo(
    () =>
      resolveSuggestCoverageFromParams({
        teamId: firstParam(params.teamId),
        teamName: firstParam(params.teamName),
        conferenceId: firstParam(params.conferenceId),
        conferenceName: firstParam(params.conferenceName),
      }),
    [params.teamId, params.teamName, params.conferenceId, params.conferenceName],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [linkRows, setLinkRows] = useState<MediaLinkRowInput[]>(() => [
    createEmptyMediaLinkRow(0, initialCoverage),
  ]);
  const [coverageEditorIndex, setCoverageEditorIndex] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [labelOpenByIndex, setLabelOpenByIndex] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MediaSuggestionFieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showNotesField = notesOpen || Boolean(notes.trim());
  const coverageSheetOpen = coverageEditorIndex != null;
  const activeLinkCoverage =
    coverageEditorIndex != null && linkRows[coverageEditorIndex]
      ? getMediaLinkRowBrowseFilter(linkRows[coverageEditorIndex]!)
      : createEmptyMediaBrowseFilter();

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
  }, [favorites, coverageSheetOpen]);

  const stickyBottomPad = Math.max(insets.bottom, spacing.sm);
  const scrollBottomPad =
    STICKY_SUBMIT_HEIGHT +
    stickyBottomPad +
    spacing.md +
    (keyboardHeight > 0 ? spacing.lg : spacing.sm);

  useEffect(() => {
    if (keyboardHeight <= 0 || !focusedInputRef.current) return;
    const delay = Platform.OS === 'ios' ? 80 : 120;
    const timer = setTimeout(() => {
      void ensureFocusedInputVisible(scrollRef, focusedInputRef.current, scrollYRef.current);
    }, delay);
    return () => clearTimeout(timer);
  }, [keyboardHeight]);

  function onInputFocus(event: { target?: unknown }) {
    const target = event.target as Parameters<typeof findNodeHandle>[0] | null | undefined;
    focusedInputRef.current = target ?? null;
    const delay = Platform.OS === 'ios' ? 100 : 160;
    setTimeout(() => {
      void ensureFocusedInputVisible(scrollRef, target, scrollYRef.current);
    }, delay);
  }

  function onInputBlur() {
    focusedInputRef.current = null;
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
      delete next[`links.${index}.coverage`];
      return next;
    });
  }

  function finalizeLinkUrl(index: number) {
    setLinkRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const url = normalizeSuggestLinkUrl(String(row.url ?? ''));
        const detected = detectMediaPlatformFromUrl(url);
        const host = getSuggestLinkUrlHostKey(url);
        const manualSticky =
          Boolean(row.platformManual) &&
          Boolean(row.platformManualHostKey) &&
          row.platformManualHostKey === host;
        if (!detected || manualSticky) {
          return { ...row, url };
        }
        return {
          ...row,
          url,
          platform: detected,
          platformManual: false,
          platformManualHostKey: null,
        };
      }),
    );
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.links;
      delete next[`links.${index}.url`];
      delete next[`links.${index}.platform`];
      return next;
    });
  }

  function setLinkPlatformManual(index: number, platform: MediaPlatformLinkKey) {
    setLinkRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        return {
          ...row,
          platform,
          platformManual: true,
          platformManualHostKey: getSuggestLinkUrlHostKey(String(row.url ?? '')),
        };
      }),
    );
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.links;
      delete next[`links.${index}.platform`];
      return next;
    });
  }

  function setLinkCoverage(index: number, filter: MediaBrowseFilter) {
    updateLinkRow(index, { coverage: cloneMediaBrowseFilter(filter) });
  }

  function addLinkRow() {
    setLinkRows((current) => {
      const previous = current[current.length - 1];
      const inherit = previous
        ? getMediaLinkRowBrowseFilter(previous)
        : createEmptyMediaBrowseFilter();
      return [...current, createEmptyMediaLinkRow(current.length, inherit)];
    });
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
    setLabelOpenByIndex((current) => {
      const next: Record<number, boolean> = {};
      for (const [key, open] of Object.entries(current)) {
        const fromIndex = Number(key);
        if (Number.isNaN(fromIndex) || fromIndex === index) continue;
        const toIndex = fromIndex > index ? fromIndex - 1 : fromIndex;
        next[toIndex] = open;
      }
      return next;
    });
    setCoverageEditorIndex((current) => {
      if (current == null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.links;
      return next;
    });
  }

  function resetForm() {
    setName('');
    setDescription('');
    setSubmitterEmail('');
    setLinkRows([createEmptyMediaLinkRow(0)]);
    setCoverageEditorIndex(null);
    setNotes('');
    setNotesOpen(false);
    setLabelOpenByIndex({});
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
      const preparedLinks = prepareLinkRowsForSubmit(linkRows);
      setLinkRows(preparedLinks);
      const unionFilter = unionMediaBrowseFilters(
        preparedLinks.map((row) => getMediaLinkRowBrowseFilter(row)),
      );
      const mapped = mediaBrowseFilterToCoverage(unionFilter);
      const result = await submitMediaSuggestion({
        name,
        description: description.trim() || null,
        submitterEmail,
        linkRows: preparedLinks,
        isNational: mapped.isNational,
        conferenceIds: mapped.conferenceIds,
        teamIds: mapped.teamIds,
        notes: notes.trim() || null,
        coverageLabel: formatMediaBrowseCoverageLabel(unionFilter) || undefined,
        coverageLabels: buildMediaSuggestionCoverageLabels(unionFilter),
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
          <ScrollView
            ref={scrollRef}
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScroll={(event) => {
              scrollYRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Creator or Podcast Name</Text>
              <TextInput
                ref={nameRef}
                value={name}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
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
                onSubmitEditing={() => descriptionRef.current?.focus()}
                style={styles.input}
              />
              {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Creator Description</Text>
              <Text style={styles.hint}>
                Tell fans what your show, channel, or site is about.
              </Text>
              <TextInput
                ref={descriptionRef}
                value={description}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                onChangeText={setDescription}
                placeholder="Optional public description"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                style={[styles.input, styles.descriptionInput]}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.labelSecondary}>Email (optional)</Text>
              <Text style={styles.hint}>Only used if we need clarification.</Text>
              <TextInput
                ref={emailRef}
                value={submitterEmail}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
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
                  linkUrlRefs.current[0]?.focus();
                }}
                style={[styles.input, styles.emailInput]}
              />
              {fieldErrors.submitterEmail ? (
                <Text style={styles.fieldError}>{fieldErrors.submitterEmail}</Text>
              ) : null}
            </View>

            <Text style={styles.sectionHeading}>Links</Text>
            <Text style={styles.linksHelper}>
              Supports Website, YouTube, Spotify, Apple Podcasts, X, Facebook, Instagram, RSS, and
              other links.
            </Text>

            {linkRows.map((row, index) => {
              const platform = resolveLinkPlatform(row.platform);
              const showLabelField =
                Boolean(labelOpenByIndex[index]) || Boolean(row.label?.trim());
              const linkCoverage = getMediaLinkRowBrowseFilter(row);
              const coverageSummary = formatCompactMediaBrowseCoverageSummary(linkCoverage, 2);
              return (
                <View key={`link-${index}`} style={styles.linkCard}>
                  <View style={styles.linkCardHeader}>
                    <Text style={styles.linkTitle}>Link {index + 1}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove link ${index + 1}`}
                      onPress={() => removeLinkRow(index)}
                      hitSlop={10}
                      style={({ pressed }) => [styles.removeLink, pressed && styles.pressed]}>
                      <Text style={styles.removeLinkText}>Remove</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.coverageLabel}>URL</Text>
                  <TextInput
                    ref={(node) => {
                      linkUrlRefs.current[index] = node;
                    }}
                    value={row.url ?? ''}
                    onFocus={onInputFocus}
                    onBlur={() => {
                      onInputBlur();
                      finalizeLinkUrl(index);
                    }}
                    onChangeText={(value) => updateLinkRow(index, { url: value })}
                    placeholder={URL_PLACEHOLDER}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => {
                      finalizeLinkUrl(index);
                      if (showLabelField) {
                        linkLabelRefs.current[index]?.focus();
                        return;
                      }
                      if (index < linkRows.length - 1) {
                        linkUrlRefs.current[index + 1]?.focus();
                        return;
                      }
                      if (showNotesField) notesRef.current?.focus();
                    }}
                    style={styles.linkInput}
                  />
                  {fieldErrors[`links.${index}.url`] ? (
                    <Text style={styles.fieldError}>{fieldErrors[`links.${index}.url`]}</Text>
                  ) : null}

                  <Text style={styles.coverageLabel}>Platform</Text>
                  <MediaPlatformPicker
                    value={platform}
                    onChange={(next) => setLinkPlatformManual(index, next)}
                  />
                  {fieldErrors[`links.${index}.platform`] ? (
                    <Text style={styles.fieldError}>{fieldErrors[`links.${index}.platform`]}</Text>
                  ) : null}

                  <Text style={styles.coverageLabel}>Coverage</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Select coverage for link ${index + 1}`}
                    onPress={() => {
                      Keyboard.dismiss();
                      setCoverageEditorIndex(index);
                    }}
                    style={({ pressed }) => [
                      dropdownStyles.trigger,
                      styles.coverageTrigger,
                      pressed && dropdownStyles.triggerPressed,
                    ]}>
                    <Text
                      style={[
                        dropdownStyles.triggerLabel,
                        !coverageSummary && styles.coveragePlaceholder,
                      ]}
                      numberOfLines={1}>
                      {coverageSummary || 'Select coverage'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={DROPDOWN_CHEVRON_SIZE}
                      color={colors.primary}
                    />
                  </Pressable>
                  {fieldErrors[`links.${index}.coverage`] ? (
                    <Text style={styles.fieldError}>
                      {fieldErrors[`links.${index}.coverage`]}
                    </Text>
                  ) : null}

                  {showLabelField ? (
                    <TextInput
                      ref={(node) => {
                        linkLabelRefs.current[index] = node;
                      }}
                      value={row.label ?? ''}
                      onFocus={onInputFocus}
                      onBlur={onInputBlur}
                      onChangeText={(value) => updateLinkRow(index, { label: value })}
                      placeholder="Label (optional)"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => {
                        if (index < linkRows.length - 1) {
                          linkUrlRefs.current[index + 1]?.focus();
                          return;
                        }
                        if (showNotesField) notesRef.current?.focus();
                      }}
                      style={[styles.linkInput, styles.secondaryInput]}
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add label for link ${index + 1}`}
                      onPress={() => {
                        setLabelOpenByIndex((current) => ({ ...current, [index]: true }));
                        requestAnimationFrame(() => {
                          setTimeout(() => linkLabelRefs.current[index]?.focus(), 40);
                        });
                      }}
                      style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={styles.inlineActionText}>Add label</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another link"
              onPress={addLinkRow}
              style={({ pressed }) => [styles.addLinkButton, pressed && styles.pressed]}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addLinkText}>Add Another Link</Text>
            </Pressable>
            {fieldErrors.links ? <Text style={styles.fieldError}>{fieldErrors.links}</Text> : null}

            {showNotesField ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.labelSecondary}>Note for FCS Pulse</Text>
                <Text style={styles.hint}>
                  Private note for the FCS Pulse review team. This will not appear publicly.
                </Text>
                <TextInput
                  ref={notesRef}
                  value={notes}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                  onChangeText={setNotes}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  returnKeyType="default"
                  blurOnSubmit={false}
                  style={[styles.input, styles.notesInput]}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add note for FCS Pulse"
                onPress={() => {
                  setNotesOpen(true);
                  requestAnimationFrame(() => {
                    setTimeout(() => notesRef.current?.focus(), 40);
                  });
                }}
                style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.inlineActionText}>Add note for FCS Pulse</Text>
              </Pressable>
            )}

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
          </ScrollView>

          <View style={[styles.submitBar, { paddingBottom: stickyBottomPad }]}>
            {keyboardHeight > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss keyboard"
                onPress={Keyboard.dismiss}
                style={({ pressed }) => [styles.dismissKeyboard, pressed && styles.pressed]}>
                <Text style={styles.dismissKeyboardText}>Done</Text>
              </Pressable>
            ) : null}
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
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <MediaBrowseSheet
        visible={coverageSheetOpen}
        mode="coverage"
        activeFilter={activeLinkCoverage}
        teams={teams}
        conferences={conferences}
        onClose={() => setCoverageEditorIndex(null)}
        onChangeFilter={(filter) => {
          if (coverageEditorIndex == null) return;
          setLinkCoverage(coverageEditorIndex, filter);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  fieldBlock: {
    gap: 3,
  },
  sectionHeading: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: spacing.xs,
  },
  linksHelper: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: -2,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  labelSecondary: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  hint: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 15,
    color: colors.textMuted,
  },
  linkCard: {
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
  },
  linkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 28,
  },
  linkTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  removeLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 32,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  removeLinkText: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.error,
    fontWeight: '500',
    opacity: 0.85,
  },
  coverageLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  coverageTrigger: {
    minHeight: 40,
  },
  coveragePlaceholder: {
    color: colors.textMuted,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    minHeight: 34,
    paddingVertical: 2,
  },
  inlineActionText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  addLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
  },
  addLinkText: { ...typography.caption, fontWeight: '700', color: colors.primary },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    ...typography.body,
  },
  descriptionInput: {
    minHeight: 68,
    maxHeight: 96,
    paddingTop: spacing.sm,
  },
  emailInput: {
    minHeight: 42,
    paddingVertical: spacing.xs + 2,
  },
  notesInput: {
    minHeight: 56,
    maxHeight: 88,
    paddingTop: spacing.sm,
  },
  linkInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 42,
    ...typography.body,
  },
  secondaryInput: {
    minHeight: 40,
    paddingVertical: spacing.xs + 2,
  },
  submitBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { ...typography.body, color: colors.onPrimary, fontWeight: '700' },
  dismissKeyboard: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  dismissKeyboardText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  pressed: { opacity: 0.85 },
  fieldError: { ...typography.caption, color: colors.error },
  error: { ...typography.caption, color: colors.error },
  success: { ...typography.caption, color: colors.primary },
});
