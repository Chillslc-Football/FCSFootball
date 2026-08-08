import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type AdminLink = {
  href: Href;
  title: string;
  subtitle: string;
};

const DEVELOPER_TOOLS: AdminLink[] = [
  {
    href: '/developer' as Href,
    title: 'Developer',
    subtitle: 'Internal tools and data testing',
  },
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
];

const MEDIA_ADMINISTRATION: AdminLink[] = [
  {
    href: '/admin/media-submissions' as Href,
    title: 'Media submissions',
    subtitle: 'Review pending community media suggestions',
  },
  {
    href: '/developer/media-suggestions' as Href,
    title: 'Media Suggestions',
    subtitle: 'Review pending Spotify / YouTube / X suggestions (admin sign-in required)',
  },
];

const DIAGNOSTICS: AdminLink[] = [
  {
    href: '/developer/data-test' as Href,
    title: 'Data Test',
    subtitle: 'Experiment with provider fetch responses',
  },
];

export default function AdminHubScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Internal tools for administration, development, and diagnostics.</Text>

      <AdminSection title="Developer Tools" links={DEVELOPER_TOOLS} />
      <AdminSection title="Media Administration" links={MEDIA_ADMINISTRATION} />
      <AdminSection title="Diagnostics" links={DIAGNOSTICS} />
    </ScrollView>
  );
}

function AdminSection({ title, links }: { title: string; links: AdminLink[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {links.map((link) => (
        <Link key={String(link.href)} href={link.href} asChild>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Text style={styles.rowTitle}>{link.title}</Text>
            <Text style={styles.rowSubtitle}>{link.subtitle}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.85,
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
});
