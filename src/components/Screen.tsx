import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  /** Tighter top padding when the tab/header bar already shows the screen title. */
  denseTop?: boolean;
  children?: ReactNode;
};

export function Screen({ title, subtitle, denseTop = false, children }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, !denseTop && { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, denseTop && styles.contentDenseTop]}
        showsVerticalScrollIndicator={false}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  contentDenseTop: {
    paddingTop: spacing.xs,
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
