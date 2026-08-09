import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  ensureNotificationReady,
  loadLocalDesiredPreferencesSnapshot,
  NOTIFICATION_INIT_TIMEOUT_MS,
  reconcileRemoteNotificationPreferences,
  saveNotificationPreferences,
  syncPushTokenIfPermitted,
  withTimeout,
} from '@/data/notifications/deviceRegistration';
import {
  reconcileDeliveryAfterSetupSettle,
  shouldApplyDeliveryRefresh,
} from '@/data/notifications/notificationDeliveryRefresh';
import { cacheNotificationPreferences } from '@/data/notifications/notificationPreferencesStorage';
import { isNotificationDeliveryReady } from '@/data/notifications/notificationEffectiveState';
import {
  getNotificationUserStatusView,
  resolveNotificationUserStatus,
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
  const [loaded, setLoaded] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [retryingSetup, setRetryingSetup] = useState(false);

  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  /** Monotonic token so a stale reconcile cannot overwrite a newer local toggle. */
  const preferencesEpochRef = useRef(0);
  const mountedRef = useRef(true);
  /** Blocks AppState delivery refresh until first local snapshot + reconcile attempt finish. */
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

    try {
      // 1) Local cache / complete defaults — one coherent snapshot for first toggle paint.
      const local = await loadLocalDesiredPreferencesSnapshot();
      if (!mountedRef.current || generation !== hydrationGenerationRef.current) return;

      localUpdatedAtRef.current = local.updatedAt;
      if (epochAtStart === preferencesEpochRef.current) {
        preferencesRef.current = local.preferences;
        setPreferences(local.preferences);
      }
      setLoaded(true);

      // Permission for status card — independent of preference toggles.
      try {
        const status = await getNotificationPermissionStatus();
        if (mountedRef.current && generation === hydrationGenerationRef.current) {
          setPermissionStatus(status);
        }
      } catch {
        // Keep undetermined.
      }

      // 2) Remote reconcile asynchronously; never expose a partial merge.
      const reconciled = await withTimeout(
        reconcileRemoteNotificationPreferences({
          preferences: local.preferences,
          updatedAt: local.updatedAt,
        }),
        NOTIFICATION_INIT_TIMEOUT_MS,
      );

      if (!mountedRef.current || generation !== hydrationGenerationRef.current) return;

      if (reconciled) {
        applyDeliverySnapshot(reconciled.delivery);
        if (
          reconciled.source === 'remote' &&
          epochAtStart === preferencesEpochRef.current
        ) {
          localUpdatedAtRef.current = reconciled.updatedAt;
          preferencesRef.current = reconciled.preferences;
          setPreferences(reconciled.preferences);
        }
      } else {
        // Timed out — still refresh delivery so Settings is not stuck Inactive forever.
        console.warn(
          '[useNotificationPreferences] remote reconcile timed out; refreshing delivery only',
        );
        try {
          const delivery = await syncPushTokenIfPermitted();
          if (mountedRef.current && generation === hydrationGenerationRef.current) {
            applyDeliverySnapshot(delivery);
          }
        } catch (error) {
          console.warn('[useNotificationPreferences] delivery fallback failed:', error);
        }
      }
    } catch (error) {
      console.warn('[useNotificationPreferences] initialize failed:', error);
      if (mountedRef.current) {
        // Ensure toggles still appear as one complete default/local snapshot.
        setLoaded(true);
        try {
          const delivery = await syncPushTokenIfPermitted();
          if (mountedRef.current) applyDeliverySnapshot(delivery);
        } catch {
          try {
            const status = await getNotificationPermissionStatus();
            if (mountedRef.current) setPermissionStatus(status);
          } catch {
            if (mountedRef.current) setPermissionStatus('undetermined');
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
   * Soft refresh on AppState — never reloads desired preferences.
   * Must not regress healthy Settings readiness after a flaky probe
   * (e.g. returning from Notification Diagnostics).
   */
  const refreshDeliveryStatus = useCallback(async () => {
    try {
      const delivery = await syncPushTokenIfPermitted();
      applyDeliverySnapshot(delivery, { mode: 'soft' });
    } catch (error) {
      console.warn('[useNotificationPreferences] delivery refresh failed:', error);
      try {
        const status = await getNotificationPermissionStatus();
        if (!mountedRef.current) return;
        // Soft path: only apply permission when denied; otherwise keep readiness.
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
        // Returning from the system permission sheet must not rewrite switch values
        // or race the initial preference hydration.
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

  const userStatus = resolveNotificationUserStatus({
    permissionStatus,
    deviceRegistered,
    hasPushToken,
  });
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
      // Local persistence first (memory + AsyncStorage). Never block the switch on network.
      void cacheNotificationPreferences(next, updatedAt);

      const enabling = Object.values(patch).some((value) => value === true);

      // Persist latest desired prefs; read from ref so rapid taps don't write a stale snapshot.
      void saveNotificationPreferences(preferencesRef.current).catch((error) => {
        console.warn('[useNotificationPreferences] remote preference save failed:', error);
      });

      // Turning ON may improve delivery readiness in the background. Turning OFF never does this.
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

        // Late register_device success after setup race timeout: one bounded confirm.
        const reconciled = await reconcileDeliveryAfterSetupSettle({
          setupResult: ready.result,
          setupSnapshot,
          syncDelivery: syncPushTokenIfPermitted,
          withTimeout,
        });
        if (!mountedRef.current || attempt !== setupAttemptRef.current) return;

        applyDeliverySnapshot(reconciled);

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

  /** Explicit user action — does not run just because Settings opened. */
  const enableNotifications = useCallback(async () => {
    await runBoundedSetupAttempt('enable');
  }, [runBoundedSetupAttempt]);

  /** Retry registration/token attach when permission is already granted. */
  const retryNotificationSetup = useCallback(async () => {
    await runBoundedSetupAttempt('retry');
  }, [runBoundedSetupAttempt]);

  const openSystemSettings = useCallback(async () => {
    await Linking.openSettings();
    setPermissionStatus(await getNotificationPermissionStatus());
  }, []);

  return {
    /** Saved / desired preferences (switch values). Independent of Delivery readiness. */
    preferences,
    permissionStatus,
    deviceRegistered,
    hasPushToken,
    deliveryReady,
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
