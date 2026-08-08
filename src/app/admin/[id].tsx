import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  adminApproveMediaSubmission,
  adminGetMediaSubmission,
  adminRejectMediaSubmission,
  adminSetMediaCreatorStatus,
  adminUpdateMediaSubmission,
} from '@/data/media/mediaAdminApi';
import { useAdminAuth } from '@/data/media/useAdminAuth';
import {
  MEDIA_RESOURCE_TYPE_LABELS,
  type MediaSubmissionDetail,
  type MediaSubmissionLinkRow,
} from '@/data/media/types';
import { colors, spacing, typography } from '@/theme';

export default function AdminSubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAdminAuth();

  const [detail, setDetail] = useState<MediaSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [description, setDescription] = useState('');
  const [submittedName, setSubmittedName] = useState('');

  const load = useCallback(async () => {
    if (!auth.isAdmin || !id) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await adminGetMediaSubmission(id);
      setDetail(payload);
      setSubmittedName(payload.submission.submitted_name);
      setDescription(payload.submission.description ?? '');
      setAdminNotes(payload.submission.admin_notes ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [auth.isAdmin, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!auth.loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!auth.isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Administrator sign-in required.</Text>
        <Pressable onPress={() => router.replace('/admin/media-submissions' as Href)}>
          <Text style={styles.link}>Go to admin sign-in</Text>
        </Pressable>
      </View>
    );
  }

  async function runAction(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  const row = detail?.submission;
  const links = detail?.links ?? [];
  const submissionTypeLabel =
    row?.submission_type === 'add_links'
      ? 'Add links to existing creator'
      : 'New creator or outlet';

  return (
    <>
      <Stack.Screen options={{ title: 'Review submission' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        {row ? (
          <>
            <Text style={styles.meta}>Status: {row.status}</Text>
            <Text style={styles.meta}>Submission type: {submissionTypeLabel}</Text>
            <Text style={styles.meta}>
              Scope: {row.scope}
              {row.team_name ? ` · ${row.team_name}` : ''}
            </Text>
            <Text style={styles.meta}>
              Submitted {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
            </Text>
            <Text style={styles.meta}>
              Submitter: {row.submitter_name || '—'} / {row.submitter_email || '—'}
            </Text>
            {row.submitter_notes ? (
              <Text style={styles.meta}>Notes: {row.submitter_notes}</Text>
            ) : null}

            <Text style={styles.sectionTitle}>Creator / outlet</Text>
            <Field label="Name" value={submittedName} onChangeText={setSubmittedName} />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.sectionTitle}>Links</Text>
            {links.length === 0 ? (
              <Text style={styles.meta}>No links on this submission.</Text>
            ) : (
              links.map((link, index) => <AdminLinkCard key={`${link.url}-${index}`} link={link} />)
            )}

            <Field label="Admin notes" value={adminNotes} onChangeText={setAdminNotes} multiline />

            <Pressable
              disabled={saving}
              style={styles.button}
              onPress={() =>
                void runAction(async () => {
                  await adminUpdateMediaSubmission(row.id, {
                    submittedName,
                    description,
                    adminNotes,
                    scope: row.scope,
                    teamName: row.team_name ?? '',
                    teamId: row.team_id ?? '',
                    resourceType: row.resource_type,
                    submittedUrl: row.submitted_url,
                  });
                  setMessage('Saved submission edits.');
                })
              }>
              <Text style={styles.buttonText}>Save edits</Text>
            </Pressable>

            <Pressable
              disabled={saving}
              style={styles.button}
              onPress={() =>
                void runAction(async () => {
                  await adminApproveMediaSubmission(row.id, adminNotes);
                  setMessage(
                    row.submission_type === 'add_links'
                      ? 'Approved — links attached to the existing creator.'
                      : 'Approved — creator published with links.',
                  );
                })
              }>
              <Text style={styles.buttonText}>Approve & publish</Text>
            </Pressable>

            <Pressable
              disabled={saving}
              style={styles.dangerButton}
              onPress={() =>
                void runAction(async () => {
                  await adminRejectMediaSubmission(row.id, adminNotes);
                  setMessage('Submission rejected.');
                })
              }>
              <Text style={styles.buttonText}>Reject</Text>
            </Pressable>

            {row.published_creator_id ? (
              <Pressable
                disabled={saving}
                style={styles.dangerButton}
                onPress={() =>
                  void runAction(async () => {
                    await adminSetMediaCreatorStatus(row.published_creator_id!, 'inactive');
                    setMessage('Public listing deactivated.');
                  })
                }>
                <Text style={styles.buttonText}>Deactivate published listing</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function AdminLinkCard({ link }: { link: MediaSubmissionLinkRow }) {
  const typeLabel = MEDIA_RESOURCE_TYPE_LABELS[link.link_type] ?? link.link_type;
  return (
    <View style={styles.linkCard}>
      <Text style={styles.linkType}>
        {typeLabel}
        {link.label ? `: ${link.label}` : ''}
      </Text>
      <Text style={styles.linkUrl} numberOfLines={2}>
        {link.url}
      </Text>
      <Pressable onPress={() => void Linking.openURL(link.url)}>
        <Text style={styles.openLink}>Open link</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  link: { ...typography.body, color: colors.primary, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textSecondary },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  linkCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  linkType: { ...typography.body, color: colors.text, fontWeight: '600' },
  linkUrl: { ...typography.caption, color: colors.textSecondary },
  openLink: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...typography.body, color: colors.background, fontWeight: '700' },
  error: { ...typography.caption, color: colors.error },
  success: { ...typography.caption, color: colors.success },
});
