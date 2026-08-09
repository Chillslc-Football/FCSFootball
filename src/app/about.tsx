import { Link, Stack, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/theme';

const ABOUT_PARAGRAPHS = [
  'FCS Pulse started with a simple idea.',
  'My dad and I wanted an easier way to follow FCS football. We wanted to see the FCS Top 25 without digging through FBS coverage, quickly find FCS vs. FBS games, and keep track of the teams we actually cared about.',
  'So I started building it.',
  'What began as a simple scores app kept growing. Schedules, polls, favorite teams, conference pages, podcasts, creators, news, and other features were added as I found more things that could make following the FCS easier.',
  "FCS Pulse is still a one-man project. There isn't a big company or development team behind it. I'm just an FCS fan building the app I wanted to use.",
  "If you find something that's wrong, have an idea, or know something that would make FCS Pulse better, please send me feedback. I'm listening.",
  'Thanks for being here, and thanks for supporting FCS football.',
];

export default function AboutScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'About FCS Pulse', headerBackTitle: 'Back' }} />
      <Screen denseTop>
        <View style={styles.body}>
          {ABOUT_PARAGRAPHS.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>

        <Link href={'/feedback' as Href} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send Feedback"
            style={({ pressed }) => [styles.feedbackButton, pressed && styles.pressed]}>
            <Text style={styles.feedbackButtonText}>Send Feedback</Text>
          </Pressable>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  paragraph: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  feedbackButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  feedbackButtonText: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  pressed: { opacity: 0.85 },
});
