import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

import { colors, spacing, typography } from '@/theme';

type AdminLink = {
  href: Href;
  title: string;
  subtitle: string;
};

const DEVELOPER_TOOLS: AdminLink[] = [
  {
    href: '/developer/espn-test' as Href,
    title: 'ESPN Data Test',
    subtitle: 'Scores & schedule via espnScoresProvider',
  },
  {
    href: '/developer/notification-test' as Href,
    title: 'Notification Test',
    subtitle: 'Local notification simulations (development only)',
  },
  {
    href: '/developer/ncaa-rankings-test' as Href,
    title: 'NCAA Rankings Test',
    subtitle: 'Stats Perform FCS Top 25 — not connected yet',
  },
  {
    href: '/developer/data-test' as Href,
    title: 'Data Test',
    subtitle: 'Experiment with provider fetch responses',
  },
];

const MEDIA_ADMIN_TOOLS: AdminLink[] = [
  {
    href: '/admin' as Href,
    title: 'Media Admin',
    subtitle: 'Review pending community media submissions (admin sign-in required)',
  },
  {
    href: '/developer/media-suggestions' as Href,
    title: 'Media Suggestions',
    subtitle: 'Review pending Spotify / YouTube / X suggestions (admin sign-in required)',
  },
];

function AdminRow({ item }: { item: AdminLink }) {
  return (
    <Link href={item.href} asChild>
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </Link>
  );
}

export default function AdminHubScreen() {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const appName = Constants.expoConfig?.name ?? 'FCS Pulse';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.warning}>
        Internal tools only — not part of the normal user experience.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer Tools</Text>
        {DEVELOPER_TOOLS.map((item) => (
          <AdminRow key={String(item.href)} item={item} />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Media Administration</Text>
        {MEDIA_ADMIN_TOOLS.map((item) => (
          <AdminRow key={String(item.href)} item={item} />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diagnostics</Text>
        <View style={styles.diagCard}>
          <Text style={styles.diagLabel}>App</Text>
          <Text style={styles.diagValue}>{appName}</Text>
          <Text style={styles.diagLabel}>Version</Text>
          <Text style={styles.diagValue}>{appVersion}</Text>
          <Text style={styles.diagLabel}>Build mode</Text>
          <Text style={styles.diagValue}>{__DEV__ ? 'Development' : 'Production'}</Text>
        </View>
        <Text style={styles.diagNote}>
          Watch Link Diagnostics and other per-card diagnostics remain available on game cards in
          development builds. They are not separate Settings destinations.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  warning: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  diagCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  diagLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  diagValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  diagNote: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
