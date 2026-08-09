import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import {
  listPublicMediaCreatorOptions,
  getPublicMediaCreatorLinks,
} from '@/data/media/mediaPublicApi';
import { submitMediaResource } from '@/data/media/mediaSubmissionApi';
import {
  getMediaLinkFieldLabel,
  getMediaLinkHelperText,
  MEDIA_RESOURCE_TYPE_LABELS,
  MEDIA_RESOURCE_TYPES,
  type MediaLinkInput,
  type MediaResourceType,
  type MediaScope,
  type MediaSubmissionType,
  type PublicMediaCreator,
  type PublicMediaCreatorOption,
} from '@/data/media/types';
import { colors, spacing, typography } from '@/theme';

type LinkDraft = MediaLinkInput & { key: string };

function newLinkRow(type: MediaResourceType = 'podcast'): LinkDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    linkType: type,
    url: '',
    label: '',
  };
}

export default function SuggestMediaScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [submissionType, setSubmissionType] = useState<MediaSubmissionType | null>(null);

  const [proposedName, setProposedName] = useState('');
  const [proposedDescription, setProposedDescription] = useState('');
  const [scope, setScope] = useState<MediaScope>('national');
  const [teamName, setTeamName] = useState('');
  const [links, setLinks] = useState<LinkDraft[]>([newLinkRow()]);

  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorOptions, setCreatorOptions] = useState<PublicMediaCreatorOption[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<PublicMediaCreatorOption | null>(null);
  const [existingCreator, setExistingCreator] = useState<PublicMediaCreator | null>(null);
  const [searchingCreators, setSearchingCreators] = useState(false);

  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitterNotes, setSubmitterNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadCreatorOptions = useCallback(async (query: string) => {
    setSearchingCreators(true);
    try {
      const rows = await listPublicMediaCreatorOptions(query);
      setCreatorOptions(rows);
    } finally {
      setSearchingCreators(false);
    }
  }, []);

  useEffect(() => {
    if (submissionType !== 'add_links' || step !== 'form') return;
    const handle = setTimeout(() => {
      void loadCreatorOptions(creatorSearch);
    }, 250);
    return () => clearTimeout(handle);
  }, [creatorSearch, loadCreatorOptions, step, submissionType]);

  useEffect(() => {
    if (!selectedCreator) {
      setExistingCreator(null);
      return;
    }
    void getPublicMediaCreatorLinks(selectedCreator.id).then(setExistingCreator);
  }, [selectedCreator]);

  const typeOptions = useMemo(
    () => MEDIA_RESOURCE_TYPES.map((id) => ({ id, label: MEDIA_RESOURCE_TYPE_LABELS[id] })),
    [],
  );

  function chooseType(type: MediaSubmissionType) {
    setSubmissionType(type);
    setStep('form');
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updateLink(key: string, patch: Partial<LinkDraft>) {
    setLinks((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeLink(key: string) {
    setLinks((current) => (current.length <= 1 ? current : current.filter((row) => row.key !== key)));
  }

  function resetForm() {
    setProposedName('');
    setProposedDescription('');
    setScope('national');
    setTeamName('');
    setLinks([newLinkRow()]);
    setSelectedCreator(null);
    setExistingCreator(null);
    setCreatorSearch('');
    setSubmitterName('');
    setSubmitterEmail('');
    setSubmitterNotes('');
  }

  async function handleSubmit() {
    if (!submissionType) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await submitMediaResource({
        submissionType,
        existingCreatorId: selectedCreator?.id ?? null,
        proposedName,
        proposedDescription,
        scope,
        teamName: scope === 'team' ? teamName : null,
        links: links.map(({ linkType, url, label }) => ({ linkType, url, label })),
        submitterName,
        submitterEmail,
        submitterNotes,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setSuccessMessage(
        'Thanks — your suggestion was submitted for administrator review. It will not appear publicly until approved.',
      );
      resetForm();
      setStep('choose');
      setSubmissionType(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Suggest media', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.xxl) },
        ]}
        keyboardShouldPersistTaps="handled">
        {step === 'choose' ? (
          <View style={styles.chooseBlock}>
            <Text style={styles.intro}>Who is this for?</Text>
            <Pressable
              style={({ pressed }) => [styles.choiceCard, pressed && styles.pressed]}
              onPress={() => chooseType('new_creator')}>
              <Text style={styles.choiceTitle}>Add a new creator or outlet</Text>
              <Text style={styles.choiceSub}>
                Start a profile with one or more podcast, social, or website links.
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.choiceCard, pressed && styles.pressed]}
              onPress={() => chooseType('add_links')}>
              <Text style={styles.choiceTitle}>Add links to an existing creator or outlet</Text>
              <Text style={styles.choiceSub}>
                Attach more channels to someone already in the directory.
              </Text>
            </Pressable>
            {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
          </View>
        ) : null}

        {step === 'form' && submissionType === 'new_creator' ? (
          <View style={styles.formBlock}>
            <Pressable onPress={() => { setStep('choose'); setSubmissionType(null); }}>
              <Text style={styles.backLink}>← Change choice</Text>
            </Pressable>
            <Text style={styles.sectionHeading}>New creator or outlet</Text>
            <Field
              label="Creator or outlet name *"
              value={proposedName}
              onChangeText={setProposedName}
              placeholder="e.g. Sam Herder"
            />
            <Field
              label="Description (optional)"
              value={proposedDescription}
              onChangeText={setProposedDescription}
              multiline
              placeholder="Short intro for the profile card"
            />
            <Text style={styles.label}>Scope *</Text>
            <View style={styles.chipRow}>
              {(['national', 'team'] as const).map((option) => (
                <Chip
                  key={option}
                  label={option === 'national' ? 'National' : 'Team-specific'}
                  selected={scope === option}
                  onPress={() => setScope(option)}
                />
              ))}
            </View>
            {scope === 'team' ? (
              <Field
                label="Team *"
                value={teamName}
                onChangeText={setTeamName}
                placeholder="e.g. Montana State"
              />
            ) : null}
          </View>
        ) : null}

        {step === 'form' && submissionType === 'add_links' ? (
          <View style={styles.formBlock}>
            <Pressable onPress={() => { setStep('choose'); setSubmissionType(null); }}>
              <Text style={styles.backLink}>← Change choice</Text>
            </Pressable>
            <Text style={styles.sectionHeading}>Existing creator or outlet</Text>
            <Field
              label="Search creators"
              value={creatorSearch}
              onChangeText={setCreatorSearch}
              placeholder="Type a name"
              autoCapitalize="none"
            />
            {searchingCreators ? <ActivityIndicator color={colors.primary} /> : null}
            <View style={styles.creatorList}>
              {creatorOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedCreator(option)}
                  style={[
                    styles.creatorOption,
                    selectedCreator?.id === option.id && styles.creatorOptionSelected,
                  ]}>
                  <Text style={styles.creatorOptionName}>{option.name}</Text>
                  <Text style={styles.creatorOptionMeta}>
                    {option.scope === 'team' ? option.team_name || 'Team' : 'National'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedCreator && existingCreator ? (
              <View style={styles.existingLinks}>
                <Text style={styles.label}>Existing links</Text>
                {existingCreator.links.length === 0 ? (
                  <Text style={styles.helper}>No active links on this profile yet.</Text>
                ) : (
                  existingCreator.links.map((link) => (
                    <Text key={link.id} style={styles.existingLinkLine}>
                      {MEDIA_RESOURCE_TYPE_LABELS[link.resource_type]}
                      {link.label ? `: ${link.label}` : ''}
                    </Text>
                  ))
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 'form' ? (
          <View style={styles.formBlock}>
            <Text style={styles.sectionHeading}>
              {submissionType === 'add_links' ? 'Add another link' : 'Media links'}
            </Text>
            {links.map((row, index) => (
              <View key={row.key} style={styles.linkCard}>
                <View style={styles.linkHeader}>
                  <Text style={styles.label}>Link {index + 1}</Text>
                  {links.length > 1 ? (
                    <Pressable onPress={() => removeLink(row.key)}>
                      <Text style={styles.removeLink}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.label}>Link type</Text>
                <View style={styles.chipRow}>
                  {typeOptions.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      selected={row.linkType === option.id}
                      onPress={() => updateLink(row.key, { linkType: option.id })}
                    />
                  ))}
                </View>
                <Field
                  label={`${getMediaLinkFieldLabel(row.linkType)} *`}
                  value={row.url}
                  onChangeText={(url) => updateLink(row.key, { url })}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://"
                />
                {getMediaLinkHelperText(row.linkType) ? (
                  <Text style={styles.helper}>{getMediaLinkHelperText(row.linkType)}</Text>
                ) : null}
                <Field
                  label="Label (optional)"
                  value={row.label ?? ''}
                  onChangeText={(label) => updateLink(row.key, { label })}
                  placeholder='e.g. "Herder & Haug" or @handle'
                />
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => setLinks((current) => [...current, newLinkRow()])}>
              <Text style={styles.secondaryButtonText}>Add another link</Text>
            </Pressable>

            <Text style={styles.sectionHeading}>Optional contact</Text>
            <Field label="Your name (optional)" value={submitterName} onChangeText={setSubmitterName} />
            <Field
              label="Your email (optional)"
              value={submitterEmail}
              onChangeText={setSubmitterEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Notes for admins (optional)"
              value={submitterNotes}
              onChangeText={setSubmitterNotes}
              multiline
            />

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.submitButton,
                (pressed || submitting) && styles.pressed,
              ]}>
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitText}>Submit for review</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address' | 'url';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType ?? 'default'}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
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
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  chooseBlock: { gap: spacing.sm },
  formBlock: { gap: spacing.sm },
  intro: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
  sectionHeading: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  choiceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  choiceTitle: { ...typography.body, fontWeight: '700', color: colors.primary },
  choiceSub: { ...typography.caption, color: colors.textSecondary },
  backLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  helper: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.xs },
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
  chipTextSelected: { color: colors.onPrimary, fontWeight: '700' },
  linkCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeLink: { ...typography.caption, color: colors.error, fontWeight: '700' },
  creatorList: { gap: spacing.xs },
  creatorOption: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
  },
  creatorOptionSelected: { borderColor: colors.primary },
  creatorOptionName: { ...typography.body, color: colors.text, fontWeight: '600' },
  creatorOptionMeta: { ...typography.caption, color: colors.textSecondary },
  existingLinks: { gap: spacing.xs, marginTop: spacing.xs },
  existingLinkLine: { ...typography.caption, color: colors.textSecondary },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { ...typography.body, color: colors.primary, fontWeight: '700' },
  submitButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { ...typography.body, color: colors.onPrimary, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  errorText: { ...typography.caption, color: colors.error },
  successText: { ...typography.caption, color: colors.primary, lineHeight: 18 },
});
