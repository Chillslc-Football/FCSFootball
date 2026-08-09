import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  ensureNotificationReady,
  fetchRemoteNotificationPreferencesReadOnly,
  loadLocalDesiredPreferencesSnapshot,
  saveNotificationPreferences,
  syncPushTokenIfPermitted,
  withTimeout,
} from '@/data/notifications/deviceRegistration';
import { probeNotificationDeliveryHealth } from '@/data/notifications/notificationDeliveryHealth';
import {
  reconcileDeliveryAfterSetupSettle,
  shouldApplyDeliveryRefresh,
} from '@/data/notifications/notificationDeliveryRefresh';
import { cacheNotificationPreferences } from '@/data/notifications/notificationPreferencesStorage';
import {
  isNotificationDeliveryReady,
  reconcileNotificationPreferencesSnapshot,
} from '@/data/notifications/notificationEffectiveState';
import {
  NOTIFICATION_STARTUP_SYNC_WAIT_MS,
  waitForNotificationStartupSync,
} from '@/data/notifications/notificationStartupSync';
import {
  getNotificationUserStatusView,
  resolveNotificationUserStatus,
  type NotificationDeliveryCheckPhase,
} from '@/data/notifications/notificationUserStatus';
import type { NotificationPermissionStatus, NotificationPreferences } from '@/data/notifications/types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/data/notifications/types';
import { getNotificationPermissionStatus } from '@/services/notifications/notificationService';

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>('undetermined');
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [hasPushToken, setHasPushToken] = useState(false);
  const [deliveryCheckPhase, setDeliveryCheckPhase] =
    useState<NotificationDeliveryCheckPhase>('checking');
  const [loaded, setLoaded] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [retryingSetup, setRetryingSetup] = useState(false);

  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  /** Monotonic token so a stale reconcile cannot overwrite a newer local toggle. */
  const preferencesEpochRef = useRef(0);
  const mountedRef = useRef(true);
  /** Blocks AppState soft refresh until cold-start health probe has settled. */
  const initialHydrationSettledRef = useRef(false);
  const hydrationGenerationRef = useRef(0);
  const localUpdatedAtRef = useRef(0);
  /** Prevents duplicate concurrent Enable / Try Again attempts. */
  const setupInFlightRef = useRef(false);
  const setupAttemptRef = useRef(0);
  const deliveryRef = useRef({
    permissionStatus: 'undetermined' as NotificationPermissionStatus,
    deviceRegistered: false,
    hasPushToken: false,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyDeliverySnapshot = useCallback(
    (
      snapshot: {
        permissionStatus: NotificationPermissionStatus;
        deviceRegistered: boolean;
        hasPushToken: boolean;
      },
      options?: { mode?: 'soft' | 'hard' },
    ) => {
      if (!mountedRef.current) return;
      const mode = options?.mode ?? 'hard';
      if (
        !shouldApplyDeliveryRefresh({
          previous: deliveryRef.current,
          next: snapshot,
          mode,
        })
      ) {
        return;
      }
      deliveryRef.current = snapshot;
      setPermissionStatus(snapshot.permissionStatus);
      setDeviceRegistered(snapshot.deviceRegistered);
      setHasPushToken(snapshot.hasPushToken);
    },
    [],
  );

  const loadInitialState = useCallback(async () => {
    const generation = ++hydrationGenerationRef.current;
    const epochAtStart = preferencesEpochRef.current;
    initialHydrationSettledRef.current = false;
    setDeliveryCheckPhase('checking');

    const isCurrentGeneration = () =>
      mountedRef.current && generation === hydrationGenerationRef.current;

    try {
      // 1) Local preference snapshot only — no register_device / sync writes.
      const local = await loadLocalDesiredPreferencesSnapshot();
      if (!isCurrentGeneration()) return;

      localUpdatedAtRef.current = local.updatedAt;
      if (epochAtStart === preferencesEpochRef.current) {
        preferencesRef.current = local.preferences;
        setPreferences(local.preferences);
      }
      setLoaded(true);

      // Denied is authoritative immediately (not a false "need attention").
      try {
        const status = await getNotificationPermissionStatus();
        if (!isCurrentGeneration()) return;
        if (status === 'denied') {
          applyDeliverySnapshot({
            permissionStatus: 'denied',
            deviceRegistered: false,
            hasPushToken: false,
          });
          setDeliveryCheckPhase('settled');
          return;
        }
      } catch {
        // Stay checking until read-only probe.
      }

      // 2) Wait for NotificationBootstrap sole cold-start writer, then probe read-only.
      await withTimeout(waitForNotificationStartupSync(), NOTIFICATION_STARTUP_SYNC_WAIT_MS);
      if (!isCurrentGeneration()) return;

      // Best-effort remote prefs without register_device (device row from Bootstrap).
      try {
        const remote = await fetchRemoteNotificationPreferencesReadOnly();
        if (
          remote &&
          isCurrentGeneration() &&
          epochAtStart === preferencesEpochRef.current
        ) {
          const reconciled = reconcileNotificationPreferencesSnapshot({
            local: local.preferences,
            localUpdatedAt: local.updatedAt,
            remote: remote.preferences,
            remoteUpdatedAt: remote.updatedAtMs,
          });
          if (reconciled.source === 'remote') {
            localUpdatedAtRef.current = remote.updatedAtMs;
            preferencesRef.current = reconciled.preferences;
            setPreferences(reconciled.preferences);
            await cacheNotificationPreferences(reconciled.preferences, remote.updatedAtMs);
          }
        }
      } catch (error) {
        console.warn('[useNotificationPreferences] read-only prefs hydrate failed:', error);
      }

      if (!isCurrentGeneration()) return;

      // 3) Read-only health (Diagnostics-style) — never syncPushTokenIfPermitted here.
      const health = await probeNotificationDeliveryHealth();
      if (!isCurrentGeneration()) return;
      applyDeliverySnapshot(health);
      setDeliveryCheckPhase('settled');
    } catch (error) {
      console.warn('[useNotificationPreferences] initialize failed:', error);
      if (mountedRef.current) {
        setLoaded(true);
        try {
          const health = await probeNotificationDeliveryHealth();
          if (mountedRef.current) {
            applyDeliverySnapshot(health);
            setDeliveryCheckPhase('settled');
          }
        } catch {
          try {
            const status = await getNotificationPermissionStatus();
            if (mountedRef.current) {
              applyDeliverySnapshot({
                permissionStatus: status,
                deviceRegistered: false,
                hasPushToken: false,
              });
              setDeliveryCheckPhase('settled');
            }
          } catch {
            if (mountedRef.current) {
              setPermissionStatus('undetermined');
              setDeliveryCheckPhase('settled');
            }
          }
        }
      }
    } finally {
      if (generation === hydrationGenerationRef.current) {
        initialHydrationSettledRef.current = true;
      }
    }
  }, [applyDeliverySnapshot]);

  /**
   * Soft refresh on AppState — read-only probe (no cold-start write race).
   * Must not regress healthy → unhealthy on a flaky probe.
   */
  const refreshDeliveryStatus = useCallback(async () => {
    try {
      const delivery = await probeNotificationDeliveryHealth();
      applyDeliverySnapshot(delivery, { mode: 'soft' });
      if (mountedRef.current) setDeliveryCheckPhase('settled');
    } catch (error) {
      console.warn('[useNotificationPreferences] delivery refresh failed:', error);
      try {
        const status = await getNotificationPermissionStatus();
        if (!mountedRef.current) return;
        applyDeliverySnapshot(
          {
            permissionStatus: status,
            deviceRegistered: deliveryRef.current.deviceRegistered,
            hasPushToken: deliveryRef.current.hasPushToken,
          },
          { mode: 'soft' },
        );
      } catch {
        // Keep prior status.
      }
    }
  }, [applyDeliverySnapshot]);

  useEffect(() => {
    void loadInitialState();
  }, [loadInitialState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && initialHydrationSettledRef.current) {
        void refreshDeliveryStatus();
      }
    });
    return () => subscription.remove();
  }, [refreshDeliveryStatus]);

  const deliveryReady = isNotificationDeliveryReady({
    permissionStatus,
    deviceRegistered,
    hasPushToken,
  });

  const userStatus = resolveNotificationUserStatus(
    {
      permissionStatus,
      deviceRegistered,
      hasPushToken,
    },
    { phase: deliveryCheckPhase },
  );
  const userStatusView = getNotificationUserStatusView(userStatus);

  /**
   * Toggle desired preference: update UI immediately, cache locally, sync remotely in background.
   * Turning OFF never requests permission / push / device readiness.
   */
  const updatePreference = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      if (!loaded) return;

      preferencesEpochRef.current += 1;
      const next = { ...preferencesRef.current, ...patch };
      preferencesRef.current = next;
      setPreferences(next);

      const updatedAt = Date.now();
      localUpdatedAtRef.current = updatedAt;
      void cacheNotificationPreferences(next, updatedAt);

      const enabling = Object.values(patch).some((value) => value === true);

      void saveNotificationPreferences(preferencesRef.current).catch((error) => {
        console.warn('[useNotificationPreferences] remote preference save failed:', error);
      });

      // Explicit user-driven write path (not cold start).
      if (enabling) {
        void ensureNotificationReady({ requestPermission: true })
          .then(async (ready) => {
            const setupSnapshot = {
              permissionStatus: ready.permissionStatus,
              deviceRegistered: ready.registered,
              hasPushToken: ready.hasPushToken,
            };
            const reconciled = await reconcileDeliveryAfterSetupSettle({
              setupResult: ready.result,
              setupSnapshot,
              syncDelivery: syncPushTokenIfPermitted,
              withTimeout,
            });
            if (!mountedRef.current) return;
            applyDeliverySnapshot(reconciled);
            setDeliveryCheckPhase('settled');
          })
          .catch((error) => {
            console.warn('[useNotificationPreferences] readiness sync failed:', error);
          });
      }
    },
    [applyDeliverySnapshot, loaded],
  );

  const runBoundedSetupAttempt = useCallback(
    async (mode: 'enable' | 'retry') => {
      if (setupInFlightRef.current) return;
      setupInFlightRef.current = true;
      const attempt = ++setupAttemptRef.current;
      if (mode === 'enable') setEnablingNotifications(true);
      else setRetryingSetup(true);

      try {
        const ready = await ensureNotificationReady({ requestPermission: true });
        if (!mountedRef.current || attempt !== setupAttemptRef.current) return;

        const setupSnapshot = {
          permissionStatus: ready.permissionStatus,
          deviceRegistered: ready.registered,
          hasPushToken: ready.hasPushToken,
        };

        const reconciled = await reconcileDeliveryAfterSetupSettle({
          setupResult: ready.result,
          setupSnapshot,
          syncDelivery: syncPushTokenIfPermitted,
          withTimeout,
        });
        if (!mountedRef.current || attempt !== setupAttemptRef.current) return;

        applyDeliverySnapshot(reconciled);
        setDeliveryCheckPhase('settled');

        if (ready.result !== 'success' && typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[useNotificationPreferences] setup attempt settled incomplete', {
            mode,
            result: ready.result,
            phase: ready.phase,
            registered: ready.registered,
            hasPushToken: ready.hasPushToken,
            reconciledReady: isNotificationDeliveryReady(reconciled),
          });
        }
      } catch (error) {
        console.warn('[useNotificationPreferences] setup attempt failed:', error);
        if (!mountedRef.current || attempt !== setupAttemptRef.current) return;
        try {
          const status = await getNotificationPermissionStatus();
          applyDeliverySnapshot({
            permissionStatus: status,
            deviceRegistered: false,
            hasPushToken: false,
          });
          setDeliveryCheckPhase('settled');
        } catch {
          // Keep prior delivery snapshot; spinner still clears in finally.
        }
      } finally {
        if (attempt === setupAttemptRef.current) {
          setupInFlightRef.current = false;
          if (mountedRef.current) {
            setEnablingNotifications(false);
            setRetryingSetup(false);
          }
        }
      }
    },
    [applyDeliverySnapshot],
  );

  const enableNotifications = useCallback(async () => {
    await runBoundedSetupAttempt('enable');
  }, [runBoundedSetupAttempt]);

  const retryNotificationSetup = useCallback(async () => {
    await runBoundedSetupAttempt('retry');
  }, [runBoundedSetupAttempt]);

  const openSystemSettings = useCallback(async () => {
    await Linking.openSettings();
    const status = await getNotificationPermissionStatus();
    if (!mountedRef.current) return;
    if (status === 'denied') {
      applyDeliverySnapshot({
        permissionStatus: 'denied',
        deviceRegistered: false,
        hasPushToken: false,
      });
      setDeliveryCheckPhase('settled');
      return;
    }
    setPermissionStatus(status);
  }, [applyDeliverySnapshot]);

  return {
    /** Saved / desired preferences (switch values). Independent of Delivery readiness. */
    preferences,
    permissionStatus,
    deviceRegistered,
    hasPushToken,
    deliveryReady,
    deliveryCheckPhase,
    userStatus,
    userStatusView,
    loaded,
    enablingNotifications,
    retryingSetup,
    updatePreference,
    enableNotifications,
    retryNotificationSetup,
    openSystemSettings,
  };
}
