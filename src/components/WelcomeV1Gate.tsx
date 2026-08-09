import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isWelcomeV1Complete,
  markWelcomeV1Complete,
  subscribeWelcomeV1Reset,
} from '@/data/onboarding/welcomeStorage';
import { colors, spacing, typography } from '@/theme';

/**
 * Full-screen one-time Version 1 welcome overlay.
 * Mounts above the router so deep-link destinations stay in the stack underneath.
 */
export function WelcomeV1Gate() {
  const insets = useSafeAreaInsets();
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const complete = await isWelcomeV1Complete();
      if (cancelled) return;
      setVisible(!complete);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeWelcomeV1Reset(() => {
      setVisible(true);
      setHydrated(true);
    });
  }, []);

  const onGetStarted = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await markWelcomeV1Complete();
      setVisible(false);
    } finally {
      setSaving(false);
    }
  }, [saving]);

  if (!hydrated || !visible) {
    return null;
  }

  return (
    <View
      style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      accessibilityViewIsModal
      importantForAccessibility="yes">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            accessibilityIgnoresInvertColors
            accessible
            accessibilityRole="image"
            accessibilityLabel="FCS Pulse"
          />
          <Text style={styles.title} accessibilityRole="header">
            Welcome to FCS Pulse
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.lead}>Version 1 is here.</Text>
          <Text style={styles.paragraph}>
            FCS Pulse was built to make following FCS football easier, with scores, schedules,
            standings, polls, team rosters, and FCS media all in one place.
          </Text>

          <Text style={styles.sectionHeading}>A quick note about Version 1</Text>
          <Text style={styles.paragraph}>
            Because the app is launching before football season, live scoring and notifications
            have not yet been fully tested during live games. If you find a bug or something
            doesn&apos;t look right, please let me know through Send Feedback in Settings.
          </Text>

          <Text style={styles.sectionHeading}>Coming Soon</Text>
          <Text style={styles.paragraph}>
            Game predictions and game odds are planned for a future update, giving you even more
            information around every FCS matchup.
          </Text>

          <Text style={styles.sectionHeading}>Have an idea?</Text>
          <Text style={styles.paragraph}>
            I&apos;d love to hear it. Use Send Feedback in Settings for bugs, suggestions, or
            features you&apos;d like to see.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get Started"
          accessibilityState={{ disabled: saving, busy: saving }}
          disabled={saving}
          onPress={() => void onGetStarted()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            saving && styles.buttonDisabled,
          ]}>
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 20,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    gap: spacing.sm,
  },
  lead: {
    ...typography.heading,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sectionHeading: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 17,
  },
});
