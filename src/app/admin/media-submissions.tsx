import { Link, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  adminListMediaSubmissions,
} from '@/data/media/mediaAdminApi';
import { useAdminAuth } from '@/data/media/useAdminAuth';
import {
  MEDIA_RESOURCE_TYPE_LABELS,
  MEDIA_RESOURCE_TYPES,
  MEDIA_SUBMISSION_STATUSES,
  type MediaResourceType,
  type MediaSubmissionRow,
  type MediaSubmissionStatus,
} from '@/data/media/types';
import { colors, spacing, typography } from '@/theme';

export default function AdminMediaSubmissionsScreen() {
  const auth = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [status, setStatus] = useState<MediaSubmissionStatus | 'all'>('pending');
  const [resourceType, setResourceType] = useState<MediaResourceType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<MediaSubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!auth.isAdmin) return;
    setLoading(true);
    setListError(null);
    try {
      const data = await adminListMediaSubmissions({
        status: status === 'all' ? null : status,
        resourceType: resourceType === 'all' ? null : resourceType,
        search: search.trim() || null,
      });
      setRows(data);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Failed to load submissions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [auth.isAdmin, resourceType, search, status]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (!auth.loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!auth.configured) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Text>
      </View>
    );
  }

  if (!auth.isAdmin) {
    return (
      <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.loginTitle}>Administrator sign-in</Text>
        <Text style={styles.loginHelp}>
          Access is limited to allowlisted Supabase Auth accounts. Normal users cannot view or manage
          submissions.
        </Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Admin email"
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
        />
        {signInError ? <Text style={styles.error}>{signInError}</Text> : null}
        <Pressable
          disabled={signingIn}
          onPress={() => {
            setSigningIn(true);
            setSignInError(null);
            void auth.signIn(email, password).then((result) => {
              if (!result.ok) setSignInError(result.error);
              setSigningIn(false);
            });
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          {signingIn ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void loadRows()}
          tintColor={colors.primary}
        />
      }>
      <View style={styles.headerRow}>
        <Text style={styles.signedIn}>Signed in as {auth.email}</Text>
        <Pressable onPress={() => void auth.signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={styles.filterLabel}>Status</Text>
      <View style={styles.chipRow}>
        {(['all', ...MEDIA_SUBMISSION_STATUSES] as const).map((value) => (
          <Chip
            key={value}
            label={value}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>

      <Text style={styles.filterLabel}>Type</Text>
      <View style={styles.chipRow}>
        <Chip label="all" selected={resourceType === 'all'} onPress={() => setResourceType('all')} />
        {MEDIA_RESOURCE_TYPES.map((value) => (
          <Chip
            key={value}
            label={MEDIA_RESOURCE_TYPE_LABELS[value]}
            selected={resourceType === value}
            onPress={() => setResourceType(value)}
          />
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, team, or URL"
        placeholderTextColor={colors.textMuted}
      />

      {listError ? <Text style={styles.error}>{listError}</Text> : null}
      {loading && rows.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.message}>No submissions match these filters.</Text>
      ) : null}

      {rows.map((row) => (
        <Link key={row.id} href={`/admin/${row.id}` as Href} asChild>
          <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Text style={styles.cardTitle}>{row.submitted_name}</Text>
            <Text style={styles.cardMeta}>
              {row.status} ·{' '}
              {row.submission_type === 'add_links' ? 'Add links' : 'New creator'} · {row.scope}
              {row.team_name ? ` · ${row.team_name}` : ''}
            </Text>
            <Text style={styles.cardUrl} numberOfLines={1}>
              {row.submitted_url}
            </Text>
          </Pressable>
        </Link>
      ))}
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
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  loginContent: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  loginTitle: { ...typography.title, color: colors.text },
  loginHelp: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...typography.body, color: colors.background, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  error: { ...typography.caption, color: colors.error },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  signedIn: { ...typography.caption, color: colors.textMuted, flex: 1 },
  signOut: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  filterLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
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
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  cardMeta: { ...typography.caption, color: colors.textSecondary },
  cardUrl: { ...typography.caption, color: colors.primary },
});
