import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadAppReleasePolicy } from '@/data/release/appReleasePolicyApi';
import {
  readInstalledNativeBuild,
  resolveReleasePlatform,
  shouldEnforceReleasePolicy,
} from '@/data/release/installedAppVersion';
import { openStoreListing } from '@/data/release/openStoreListing';
import {
  applyReleasePolicySimulation,
  getReleasePolicySimulation,
  subscribeReleasePolicySimulation,
} from '@/data/release/releasePolicySimulation';
import { resolveAppUpdateState } from '@/data/release/resolveAppUpdateState';
import type { AppReleasePolicyRow, AppUpdateState } from '@/data/release/types';
import { colors, spacing, typography } from '@/theme';

type GateMode = AppUpdateState | 'loading' | 'hidden';

/**
 * Root overlay for optional / required store updates.
 * Preserves Expo Router destinations underneath (same pattern as WelcomeV1Gate).
 */
export function AppUpdateGate() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<GateMode>('loading');
  const [policy, setPolicy] = useState<AppReleasePolicyRow | null>(null);
  const [openingStore, setOpeningStore] = useState(false);
  const optionalDismissedRef = useRef(false);
  const checkingRef = useRef(false);

  const evaluate = useCallback(async (options?: { forceRefresh?: boolean }) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const platform = resolveReleasePlatform();
      const simulation = getReleasePolicySimulation();

      // Expo Go: never enforce; still honor local simulation in __DEV__.
      if (!shouldEnforceReleasePolicy()) {
        if (typeof __DEV__ !== 'undefined' && __DEV__ && simulation) {
          setMode(simulation);
          return;
        }
        setMode('hidden');
        return;
      }

      if (!platform) {
        setMode('hidden');
        return;
      }

      const installedBuild = readInstalledNativeBuild();
      const loaded = await loadAppReleasePolicy({
        platform,
        forceRefresh: options?.forceRefresh,
      });

      if (loaded.fetchFailed || !loaded.policy) {
        // Fail open — remote/infra failure must not brick the app.
        if (typeof __DEV__ !== 'undefined' && __DEV__ && simulation) {
          setMode(simulation);
          return;
        }
        setMode('hidden');
        setPolicy(null);
        return;
      }

      setPolicy(loaded.policy);
      const decision = resolveAppUpdateState({
        platform,
        installedBuild,
        latestBuild: loaded.policy.latestBuild,
        minimumSupportedBuild: loaded.policy.minimumSupportedBuild,
      });

      const state = applyReleasePolicySimulation(decision.state);
      if (state === 'optional_update' && optionalDismissedRef.current) {
        setMode('hidden');
        return;
      }
      if (state === 'current') {
        setMode('hidden');
        return;
      }
      setMode(state);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  useEffect(() => {
    return subscribeReleasePolicySimulation(() => {
      void evaluate({ forceRefresh: false });
    });
  }, [evaluate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void evaluate({ forceRefresh: false });
      }
    });
    return () => sub.remove();
  }, [evaluate]);

  useEffect(() => {
    if (mode !== 'required_update') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [mode]);

  const onUpdate = useCallback(async () => {
    if (openingStore) return;
    const platform = resolveReleasePlatform();
    if (!platform) return;
    setOpeningStore(true);
    try {
      const result = await openStoreListing({
        platform,
        storeUrl: policy?.storeUrl,
      });
      if (!result.opened) {
        Alert.alert(
          'Unable to open store',
          result.error ?? 'Please update FCS Pulse from the App Store or Google Play.',
        );
      }
    } finally {
      setOpeningStore(false);
    }
  }, [openingStore, policy?.storeUrl]);

  const onNotNow = useCallback(() => {
    optionalDismissedRef.current = true;
    setMode('hidden');
  }, []);

  // Expose refresh for developer tools via module-level bridge.
  useEffect(() => {
    registerAppUpdateGateRefresh(() => evaluate({ forceRefresh: true }));
    return () => registerAppUpdateGateRefresh(null);
  }, [evaluate]);

  if (mode === 'loading' || mode === 'hidden' || mode === 'current') {
    return null;
  }

  const isRequired = mode === 'required_update';
  const title = isRequired ? 'Update Required' : 'FCS Pulse Update Available';
  const defaultBody = isRequired
    ? 'A newer version of FCS Pulse is required to continue.'
    : 'A newer version of FCS Pulse is available.';
  const remoteMessage = isRequired
    ? policy?.requiredUpdateMessage
    : policy?.updateMessage;
  const body = remoteMessage?.trim() || defaultBody;

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
            {title}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.paragraph}>{body}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Update FCS Pulse"
          accessibilityState={{ disabled: openingStore, busy: openingStore }}
          disabled={openingStore}
          onPress={() => void onUpdate()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            openingStore && styles.buttonDisabled,
          ]}>
          {openingStore ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Update FCS Pulse</Text>
          )}
        </Pressable>

        {!isRequired ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not Now"
            onPress={onNotNow}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.secondaryButtonText}>Not Now</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

let refreshHandler: (() => void) | null = null;

function registerAppUpdateGateRefresh(handler: (() => void) | null): void {
  refreshHandler = handler;
}

/** Developer tools — force a policy refresh + re-evaluate. */
export function refreshAppUpdateGateFromDeveloper(): void {
  refreshHandler?.();
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1100,
    elevation: 1100,
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
    gap: spacing.md,
  },
  paragraph: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButton: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 17,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
});
