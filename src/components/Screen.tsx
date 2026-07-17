import { ReactNode } from 'react';
import { Platform, RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  /** Tighter top padding when the tab/header bar already shows the screen title. */
  denseTop?: boolean;
  /** Fixed controls rendered above the scrolling content (filters, tabs, etc.). */
  stickyHeader?: ReactNode;
  /** Optional second fixed row below stickyHeader (e.g. week scroller). */
  secondaryStickyHeader?: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  children?: ReactNode;
};

export function Screen({
  title,
  subtitle,
  denseTop = false,
  stickyHeader,
  secondaryStickyHeader,
  refreshControl,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const hasStickyBlock = Boolean(title || subtitle || stickyHeader || secondaryStickyHeader);

  return (
    <View style={[styles.container, !denseTop && { paddingTop: insets.top }]}>
      {hasStickyBlock ? (
        <View style={styles.stickyBlock}>
          {title ? <Text style={styles.stickyTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.stickySubtitle}>{subtitle}</Text> : null}
          {stickyHeader}
          {secondaryStickyHeader ? (
            <View style={styles.secondarySticky}>{secondaryStickyHeader}</View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        refreshControl={refreshControl}
        contentContainerStyle={[styles.content, denseTop && styles.contentDenseTop]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {!hasStickyBlock && title ? <Text style={styles.title}>{title}</Text> : null}
        {!hasStickyBlock && subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children ?? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Content coming soon</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stickyBlock: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      },
    }),
  },
  secondarySticky: {
    marginTop: spacing.sm,
    marginHorizontal: -spacing.lg,
  },
  stickyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stickySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  contentDenseTop: {
    paddingTop: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
