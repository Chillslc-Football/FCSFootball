import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  loadAppAnnouncement,
  saveAppAnnouncement,
} from '@/data/announcement/appAnnouncementApi';
import { formatAdminSignInError } from '@/data/media/adminAuthErrors';
import { useAdminAuth } from '@/data/media/useAdminAuth';
import { colors, spacing, typography } from '@/theme';

export default function AdminAnnouncementScreen() {
  const auth = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadAppAnnouncement({ forceRefresh: true });
      if (!result.announcement) {
        setError('No announcement row found. Apply the app_announcement migration.');
        return;
      }
      setAnnouncementId(result.announcement.id);
      setMessage(result.announcement.message);
      setActive(result.announcement.active);
      setStatus(`Loaded · updated ${result.announcement.updatedAt}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcement');
    } finally {
      setLoading(false);
    }
  }, [auth.isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!announcementId || saving) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await saveAppAnnouncement({
        id: announcementId,
        message,
        active,
      });
      setAnnouncementId(saved.id);
      setMessage(saved.message);
      setActive(saved.active);
      setStatus(`Saved · updated ${saved.updatedAt}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [active, announcementId, message, saving]);

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
          Access is limited to allowlisted Supabase Auth accounts.
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
            if (signingIn) return;
            setSigningIn(true);
            setSignInError(null);
            void auth
              .signIn(email, password)
              .then((result) => {
                if (!result.ok) setSignInError(result.error);
              })
              .catch((error) => {
                setSignInError(formatAdminSignInError(error, 'sign_in'));
              })
              .finally(() => {
                setSigningIn(false);
              });
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          {signingIn ? (
            <ActivityIndicator color={colors.onPrimary} />
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
      keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.signedIn}>Signed in as {auth.email}</Text>
        <Pressable onPress={() => void auth.signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={styles.help}>
        Short Home-screen message for all users. Text only — no push notification.
      </Text>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      <Text style={styles.label}>Announcement</Text>
      <TextInput
        style={styles.textArea}
        value={message}
        onChangeText={setMessage}
        multiline
        textAlignVertical="top"
        placeholder="e.g. Live scoring for some games is currently delayed."
        placeholderTextColor={colors.textMuted}
        maxLength={500}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.label}>Active</Text>
        <Switch
          accessibilityLabel="Active announcement"
          value={active}
          onValueChange={setActive}
          trackColor={{ false: colors.border, true: colors.primaryMuted }}
          thumbColor={active ? colors.primary : colors.textMuted}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save announcement"
        disabled={saving || !announcementId}
        onPress={() => void onSave()}
        style={({ pressed }) => [
          styles.button,
          (pressed || saving) && styles.pressed,
          (!announcementId || saving) && styles.buttonDisabled,
        ]}>
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loginContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
  loginTitle: {
    ...typography.heading,
    color: colors.text,
  },
  loginHelp: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  signedIn: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  signOut: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  help: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
    minHeight: 120,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.88,
  },
  status: {
    ...typography.caption,
    color: colors.primary,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
