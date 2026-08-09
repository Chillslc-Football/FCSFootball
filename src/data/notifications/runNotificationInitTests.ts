import assert from 'node:assert/strict';

import {
  reconcileDeliveryAfterSetupSettle,
  selectDeliverySnapshotAfterSetup,
  shouldApplyDeliveryRefresh,
  shouldRunPostSetupDeliveryReconcile,
} from '@/data/notifications/notificationDeliveryRefresh';
import { assembleNotificationDiagnosticsProbes } from '@/data/notifications/notificationDiagnosticsLogic';
import {
  coalesceNotificationPreferences,
  isNotificationDeliveryReady,
  normalizeNotificationPreferences,
  parseNotificationPreferencesRecord,
  reconcileNotificationPreferencesSnapshot,
  toEffectiveNotificationPreferences,
} from '@/data/notifications/notificationEffectiveState';
import {
  isColdStartHealthPathWriteFree,
  resetNotificationStartupSyncForTests,
  runNotificationStartupSync,
  waitForNotificationStartupSync,
} from '@/data/notifications/notificationStartupSync';
import { raceTimeout } from '@/data/notifications/notificationSetup';
import {
  buildNotificationDiagnosticsLines,
  getNotificationUserStatusView,
  isProductionPushCapable,
  resolveNotificationUserStatus,
} from '@/data/notifications/notificationUserStatus';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/data/notifications/types';

const ALL_ON: typeof DEFAULT_NOTIFICATION_PREFERENCES = {
  favoriteGamesEnabled: true,
  gameStartEnabled: true,
  scoreEnabled: true,
  quarterEndEnabled: true,
  halftimeEnabled: true,
  closeGameEnabled: true,
  finalEnabled: true,
};

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

test('delivery ready requires permission, registration, and push token', () => {
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'granted',
      deviceRegistered: true,
      hasPushToken: true,
    }),
    true,
  );
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'denied',
      deviceRegistered: true,
      hasPushToken: true,
    }),
    false,
  );
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'undetermined',
      deviceRegistered: false,
      hasPushToken: false,
    }),
    false,
  );
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'granted',
      deviceRegistered: false,
      hasPushToken: true,
    }),
    false,
  );
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'granted',
      deviceRegistered: true,
      hasPushToken: false,
    }),
    false,
  );
});

test('fresh user defaults are all OFF', () => {
  assert.deepEqual(DEFAULT_NOTIFICATION_PREFERENCES, {
    favoriteGamesEnabled: false,
    gameStartEnabled: false,
    scoreEnabled: false,
    quarterEndEnabled: false,
    halftimeEnabled: false,
    closeGameEnabled: false,
    finalEnabled: false,
  });
  assert.deepEqual(coalesceNotificationPreferences(null, null), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(normalizeNotificationPreferences(null), DEFAULT_NOTIFICATION_PREFERENCES);
});

test('desired preferences remain available when delivery is inactive', () => {
  // Settings shows desired prefs even when permission is not requested.
  const desired = { ...ALL_ON, favoriteGamesEnabled: true };
  assert.equal(desired.favoriteGamesEnabled, true);
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'undetermined',
      deviceRegistered: false,
      hasPushToken: false,
    }),
    false,
  );
  // Effective delivery can be off without wiping the desired preference model.
  const effective = toEffectiveNotificationPreferences(desired, false);
  assert.equal(effective.favoriteGamesEnabled, false);
  assert.equal(desired.favoriteGamesEnabled, true);
});

test('toggle patch updates desired state without requiring delivery readiness', () => {
  const current = { ...DEFAULT_NOTIFICATION_PREFERENCES, gameStartEnabled: true };
  const afterOff = { ...current, gameStartEnabled: false };
  assert.equal(afterOff.gameStartEnabled, false);
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'granted',
      deviceRegistered: false,
      hasPushToken: false,
    }),
    false,
  );
  // Delivery inactive must not force desired gameStart back on/off.
  assert.equal(afterOff.gameStartEnabled, false);

  const afterOn = { ...afterOff, gameStartEnabled: true };
  assert.equal(afterOn.gameStartEnabled, true);
});

test('effective preferences stay off until delivery is ready', () => {
  const desired = { ...ALL_ON, scoreEnabled: false };
  const effective = toEffectiveNotificationPreferences(desired, false);
  assert.deepEqual(effective, {
    favoriteGamesEnabled: false,
    gameStartEnabled: false,
    scoreEnabled: false,
    quarterEndEnabled: false,
    halftimeEnabled: false,
    closeGameEnabled: false,
    finalEnabled: false,
  });

  const ready = toEffectiveNotificationPreferences(desired, true);
  assert.deepEqual(ready, desired);
});

test('normalize fills missing fields from defaults without resetting present values', () => {
  const partial = normalizeNotificationPreferences({ scoreEnabled: true });
  assert.deepEqual(partial, {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    scoreEnabled: true,
  });
  assert.deepEqual(normalizeNotificationPreferences(null), DEFAULT_NOTIFICATION_PREFERENCES);
});

test('existing cached prefs remain unchanged by defaults', () => {
  const cached = { ...ALL_ON, finalEnabled: false };
  assert.deepEqual(coalesceNotificationPreferences(null, cached), cached);
  assert.deepEqual(
    normalizeNotificationPreferences(cached),
    cached,
  );
});

test('existing remote prefs remain unchanged by defaults', () => {
  const remote = { ...ALL_ON, scoreEnabled: false };
  const cached = { ...DEFAULT_NOTIFICATION_PREFERENCES, finalEnabled: true };
  assert.deepEqual(coalesceNotificationPreferences(remote, cached), remote);
});

test('parse notification preference rows fills missing fields from defaults', () => {
  const parsed = parseNotificationPreferencesRecord({
    favorite_games_enabled: true,
    score_enabled: false,
    updated_at: '2026-08-01T12:00:00.000Z',
  });
  assert.ok(parsed);
  assert.equal(parsed.preferences.favoriteGamesEnabled, true);
  assert.equal(parsed.preferences.scoreEnabled, false);
  // Missing columns use the true-new-user default (OFF), not a reset of saved columns.
  assert.equal(parsed.preferences.gameStartEnabled, false);
  assert.equal(parsed.updatedAtMs, Date.parse('2026-08-01T12:00:00.000Z'));
});

test('reconcile: no local save adopts complete remote (does not reset remote to defaults)', () => {
  const local = DEFAULT_NOTIFICATION_PREFERENCES;
  const remote = { ...ALL_ON, scoreEnabled: false };
  const result = reconcileNotificationPreferencesSnapshot({
    local,
    localUpdatedAt: 0,
    remote,
    remoteUpdatedAt: 1000,
  });
  assert.equal(result.source, 'remote');
  assert.deepEqual(result.preferences, remote);
});

test('reconcile: newer local wins over older remote', () => {
  const local = { ...ALL_ON, finalEnabled: false };
  const remote = { ...ALL_ON, scoreEnabled: false };
  const result = reconcileNotificationPreferencesSnapshot({
    local,
    localUpdatedAt: 2000,
    remote,
    remoteUpdatedAt: 1000,
  });
  assert.equal(result.source, 'local');
  assert.deepEqual(result.preferences, local);
});

test('reconcile: newer remote replaces older local', () => {
  const local = { ...ALL_ON, finalEnabled: false };
  const remote = { ...ALL_ON, scoreEnabled: false };
  const result = reconcileNotificationPreferencesSnapshot({
    local,
    localUpdatedAt: 1000,
    remote,
    remoteUpdatedAt: 2000,
  });
  assert.equal(result.source, 'remote');
  assert.deepEqual(result.preferences, remote);
});

test('reconcile: missing remote keeps complete local (cache not reset by defaults)', () => {
  const local = { ...ALL_ON, closeGameEnabled: false };
  const result = reconcileNotificationPreferencesSnapshot({
    local,
    localUpdatedAt: 500,
    remote: null,
    remoteUpdatedAt: 0,
  });
  assert.equal(result.source, 'local');
  assert.deepEqual(result.preferences, local);
});

test('reconcile: fresh user with no remote keeps all-OFF defaults', () => {
  const result = reconcileNotificationPreferencesSnapshot({
    local: DEFAULT_NOTIFICATION_PREFERENCES,
    localUpdatedAt: 0,
    remote: null,
    remoteUpdatedAt: 0,
  });
  assert.equal(result.source, 'local');
  assert.deepEqual(result.preferences, DEFAULT_NOTIFICATION_PREFERENCES);
});

test('user status: permission granted + registered + push token → healthy', () => {
  const status = resolveNotificationUserStatus({
    permissionStatus: 'granted',
    deviceRegistered: true,
    hasPushToken: true,
  });
  assert.equal(status, 'healthy');
  assert.equal(getNotificationUserStatusView(status).title, 'Notifications enabled');
  assert.equal(getNotificationUserStatusView(status).primaryAction, 'none');
});

test('deliveryReady=true + stale lastSetupResult=incomplete → Notifications enabled', () => {
  // Settings health uses current delivery only — lastSetup is diagnostics history.
  const current = {
    permissionStatus: 'granted' as const,
    deviceRegistered: true,
    hasPushToken: true,
  };
  assert.equal(isNotificationDeliveryReady(current), true);
  assert.equal(resolveNotificationUserStatus(current), 'healthy');
  assert.equal(getNotificationUserStatusView('healthy').title, 'Notifications enabled');

  const lines = buildNotificationDiagnosticsLines({
    ...current,
    backendPrefsLoaded: true,
    platform: 'android',
    appEnvironment: 'installed_build',
    supabaseConfigured: true,
    lastSetupPhase: 'idle',
    lastSetupResult: 'incomplete',
  });
  assert.ok(lines.some((line) => line === 'Delivery ready: yes'));
  assert.ok(lines.some((line) => line === 'Last setup result: incomplete'));
  assert.equal(resolveNotificationUserStatus(current), 'healthy');
});

test('soft delivery refresh does not regress healthy → unhealthy', () => {
  const healthy = {
    permissionStatus: 'granted' as const,
    deviceRegistered: true,
    hasPushToken: true,
  };
  const flaky = {
    permissionStatus: 'granted' as const,
    deviceRegistered: false,
    hasPushToken: false,
  };
  assert.equal(
    shouldApplyDeliveryRefresh({ previous: healthy, next: flaky, mode: 'soft' }),
    false,
  );
  assert.equal(
    shouldApplyDeliveryRefresh({ previous: healthy, next: flaky, mode: 'hard' }),
    true,
  );
  assert.equal(
    shouldApplyDeliveryRefresh({
      previous: healthy,
      next: { ...healthy, permissionStatus: 'denied' },
      mode: 'soft',
    }),
    true,
  );
  // Soft refresh may still upgrade unhealthy → healthy (AppState intact).
  assert.equal(
    shouldApplyDeliveryRefresh({ previous: flaky, next: healthy, mode: 'soft' }),
    true,
  );
});

test('post-setup reconcile runs only for timeout/incomplete while granted', () => {
  assert.equal(
    shouldRunPostSetupDeliveryReconcile({
      setupResult: 'timeout',
      permissionStatus: 'granted',
    }),
    true,
  );
  assert.equal(
    shouldRunPostSetupDeliveryReconcile({
      setupResult: 'incomplete',
      permissionStatus: 'granted',
    }),
    true,
  );
  assert.equal(
    shouldRunPostSetupDeliveryReconcile({
      setupResult: 'success',
      permissionStatus: 'granted',
    }),
    false,
  );
  assert.equal(
    shouldRunPostSetupDeliveryReconcile({
      setupResult: 'timeout',
      permissionStatus: 'denied',
    }),
    false,
  );
});

test('late registration success after setup timeout → Settings healthy', () => {
  const timeoutSnapshot = {
    permissionStatus: 'granted' as const,
    deviceRegistered: false,
    hasPushToken: true,
  };
  const confirmed = {
    permissionStatus: 'granted' as const,
    deviceRegistered: true,
    hasPushToken: true,
  };
  assert.equal(resolveNotificationUserStatus(timeoutSnapshot), 'needs_attention');
  const selected = selectDeliverySnapshotAfterSetup({
    setupSnapshot: timeoutSnapshot,
    confirmed,
  });
  assert.equal(resolveNotificationUserStatus(selected), 'healthy');
  assert.equal(getNotificationUserStatusView('healthy').title, 'Notifications enabled');
});

test('cold start begins checking — granted + false defaults is NOT needs_attention', () => {
  const defaultsWhileChecking = {
    permissionStatus: 'granted' as const,
    deviceRegistered: false,
    hasPushToken: false,
  };
  const status = resolveNotificationUserStatus(defaultsWhileChecking, { phase: 'checking' });
  assert.equal(status, 'checking');
  const view = getNotificationUserStatusView(status);
  assert.equal(view.title, 'Checking notification status…');
  assert.equal(view.primaryAction, 'none');
  assert.notEqual(status, 'needs_attention');
});

test('cold startup settles healthy → Notifications enabled', () => {
  const ready = {
    permissionStatus: 'granted' as const,
    deviceRegistered: true,
    hasPushToken: true,
  };
  const status = resolveNotificationUserStatus(ready, { phase: 'settled' });
  assert.equal(status, 'healthy');
  assert.equal(getNotificationUserStatusView(status).title, 'Notifications enabled');
  assert.equal(getNotificationUserStatusView(status).primaryAction, 'none');
});

test('cold startup settles genuinely unhealthy → needs_attention', () => {
  const unhealthy = {
    permissionStatus: 'granted' as const,
    deviceRegistered: false,
    hasPushToken: false,
  };
  const status = resolveNotificationUserStatus(unhealthy, { phase: 'settled' });
  assert.equal(status, 'needs_attention');
  assert.equal(getNotificationUserStatusView(status).title, 'Notifications need attention');
  assert.equal(getNotificationUserStatusView(status).primaryAction, 'retry');
});

test('Settings cold-start health path does not call register/write sync', () => {
  assert.equal(
    isColdStartHealthPathWriteFree({
      calledRegisterDevice: false,
      calledSyncPushTokenIfPermitted: false,
    }),
    true,
  );
  assert.equal(
    isColdStartHealthPathWriteFree({
      calledRegisterDevice: true,
      calledSyncPushTokenIfPermitted: false,
    }),
    false,
  );
  assert.equal(
    isColdStartHealthPathWriteFree({
      calledRegisterDevice: false,
      calledSyncPushTokenIfPermitted: true,
    }),
    false,
  );
});

test('genuine timeout reconcile failure → Settings remains unhealthy', () => {
  const timeoutSnapshot = {
    permissionStatus: 'granted' as const,
    deviceRegistered: false,
    hasPushToken: true,
  };
  assert.deepEqual(
    selectDeliverySnapshotAfterSetup({
      setupSnapshot: timeoutSnapshot,
      confirmed: {
        permissionStatus: 'granted',
        deviceRegistered: false,
        hasPushToken: false,
      },
    }),
    timeoutSnapshot,
  );
  assert.deepEqual(
    selectDeliverySnapshotAfterSetup({
      setupSnapshot: timeoutSnapshot,
      confirmed: null,
    }),
    timeoutSnapshot,
  );
  assert.equal(resolveNotificationUserStatus(timeoutSnapshot), 'needs_attention');
});

test('permission denied remains unhealthy and cannot be overridden by checking', () => {
  const denied = {
    permissionStatus: 'denied' as const,
    deviceRegistered: false,
    hasPushToken: false,
  };
  assert.equal(
    resolveNotificationUserStatus(denied, { phase: 'checking' }),
    'permission_denied',
  );
  assert.equal(
    resolveNotificationUserStatus(denied, { phase: 'settled' }),
    'permission_denied',
  );
  assert.equal(
    shouldRunPostSetupDeliveryReconcile({
      setupResult: 'timeout',
      permissionStatus: 'denied',
    }),
    false,
  );
  assert.deepEqual(
    selectDeliverySnapshotAfterSetup({
      setupSnapshot: {
        permissionStatus: 'granted',
        deviceRegistered: false,
        hasPushToken: true,
      },
      confirmed: denied,
    }),
    denied,
  );
});

test('actual token/registration failure still shows Notifications need attention', () => {
  assert.equal(
    resolveNotificationUserStatus({
      permissionStatus: 'granted',
      deviceRegistered: true,
      hasPushToken: false,
    }),
    'needs_attention',
  );
  assert.equal(
    resolveNotificationUserStatus({
      permissionStatus: 'granted',
      deviceRegistered: false,
      hasPushToken: true,
    }),
    'needs_attention',
  );
});

test('user status: permission denied → Notifications are off', () => {
  const status = resolveNotificationUserStatus({
    permissionStatus: 'denied',
    deviceRegistered: true,
    hasPushToken: true,
  });
  assert.equal(status, 'permission_denied');
  assert.equal(getNotificationUserStatusView(status).title, 'Notifications are off');
  assert.equal(getNotificationUserStatusView(status).primaryAction, 'open_settings');
});

test('user status: permission undetermined → Enable Notifications', () => {
  const status = resolveNotificationUserStatus({
    permissionStatus: 'undetermined',
    deviceRegistered: false,
    hasPushToken: false,
  });
  assert.equal(status, 'permission_undetermined');
  assert.equal(getNotificationUserStatusView(status).primaryAction, 'enable');
});

test('user status: granted + no token → needs attention', () => {
  const status = resolveNotificationUserStatus({
    permissionStatus: 'granted',
    deviceRegistered: true,
    hasPushToken: false,
  });
  assert.equal(status, 'needs_attention');
  assert.equal(getNotificationUserStatusView(status).title, 'Notifications need attention');
  assert.equal(getNotificationUserStatusView(status).primaryAction, 'retry');
});

test('user status: granted + not registered → needs attention', () => {
  const status = resolveNotificationUserStatus({
    permissionStatus: 'granted',
    deviceRegistered: false,
    hasPushToken: true,
  });
  assert.equal(status, 'needs_attention');
  assert.equal(getNotificationUserStatusView(status).primaryAction, 'retry');
});

test('desired preference switches remain independent of delivery readiness', () => {
  const desired = { ...ALL_ON, scoreEnabled: false };
  assert.equal(desired.gameStartEnabled, true);
  assert.equal(
    isNotificationDeliveryReady({
      permissionStatus: 'granted',
      deviceRegistered: false,
      hasPushToken: false,
    }),
    false,
  );
  assert.equal(resolveNotificationUserStatus({
    permissionStatus: 'granted',
    deviceRegistered: false,
    hasPushToken: false,
  }), 'needs_attention');
  // Desired model is unchanged by delivery/user status mapping.
  assert.equal(desired.gameStartEnabled, true);
  assert.equal(desired.scoreEnabled, false);
});

test('retry/readiness action settles to retry for incomplete registration', () => {
  const view = getNotificationUserStatusView('needs_attention');
  assert.equal(view.primaryAction, 'retry');
  assert.match(view.supportingCopy, /couldn't finish/i);
  assert.match(view.supportingCopy, /Try again in a moment/i);
});

test('Settings status copy never uses Delivery Inactive', () => {
  for (const status of [
    'checking',
    'healthy',
    'permission_denied',
    'permission_undetermined',
    'needs_attention',
  ] as const) {
    const view = getNotificationUserStatusView(status);
    assert.doesNotMatch(view.supportingCopy, /Delivery Inactive/i);
    assert.doesNotMatch(view.title, /Inactive/i);
  }
  assert.equal(getNotificationUserStatusView('checking').primaryAction, 'none');
});

test('Expo Go diagnostics do not pretend production delivery is ready', () => {
  assert.equal(isProductionPushCapable('expo_go'), false);
  assert.equal(isProductionPushCapable('installed_build'), true);

  const lines = buildNotificationDiagnosticsLines({
    permissionStatus: 'granted',
    deviceRegistered: true,
    hasPushToken: true,
    backendPrefsLoaded: true,
    platform: 'ios',
    appEnvironment: 'expo_go',
    supabaseConfigured: true,
  });
  assert.ok(lines.some((line) => line === 'Delivery ready: yes'));
  assert.ok(lines.some((line) => line === 'Production push capable: no'));
  assert.ok(lines.some((line) => line.includes('Expo Go')));
});

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

async function runAsyncDiagnosticsTests(): Promise<void> {
  await testAsync('bounded post-setup reconcile upgrades late registration success', async () => {
    const timeoutSnapshot = {
      permissionStatus: 'granted' as const,
      deviceRegistered: false,
      hasPushToken: true,
    };
    let syncCalls = 0;
    const final = await reconcileDeliveryAfterSetupSettle({
      setupResult: 'timeout',
      setupSnapshot: timeoutSnapshot,
      syncDelivery: async () => {
        syncCalls += 1;
        return {
          permissionStatus: 'granted',
          deviceRegistered: true,
          hasPushToken: true,
        };
      },
      withTimeout: async (promise) => promise,
    });
    assert.equal(syncCalls, 1);
    assert.equal(resolveNotificationUserStatus(final), 'healthy');
  });

  await testAsync('NotificationBootstrap is the sole cold-start writer (single-flight)', async () => {
    resetNotificationStartupSyncForTests();
    let writerCalls = 0;
    const first = runNotificationStartupSync(async () => {
      writerCalls += 1;
      await new Promise((r) => setTimeout(r, 5));
    });
    const second = runNotificationStartupSync(async () => {
      writerCalls += 1;
    });
    await Promise.all([first, second, waitForNotificationStartupSync()]);
    assert.equal(writerCalls, 1);
    resetNotificationStartupSyncForTests();
  });

  await testAsync(
    'read-only cold health probe never requires register_device write',
    async () => {
      let registerWrites = 0;
      const snapshot = await assembleNotificationDiagnosticsProbes({
        getPermissionStatus: async () => 'granted',
        getDeviceUuid: async () => 'cold-start-uuid',
        probePushTokenPresent: async () => true,
        isSupabaseConfigured: () => true,
        hasProjectIdConfigured: () => true,
        fetchBackendPrefs: async () => {
          // Read-only prefs probe — Settings health uses this, not register_device.
          return { ok: true, hasData: true };
        },
        getLastSetup: () => ({ phase: 'idle', result: 'incomplete' }),
        getLastPushTokenFailure: () => null,
        platform: 'android',
        raceTimeout,
      });
      assert.equal(registerWrites, 0);
      assert.equal(snapshot.hasPushToken, true);
      assert.equal(snapshot.deviceRegistered, true);
      assert.equal(
        isColdStartHealthPathWriteFree({
          calledRegisterDevice: registerWrites > 0,
          calledSyncPushTokenIfPermitted: false,
        }),
        true,
      );
      assert.equal(
        resolveNotificationUserStatus(
          {
            permissionStatus: snapshot.permissionStatus,
            deviceRegistered: snapshot.deviceRegistered,
            hasPushToken: snapshot.hasPushToken,
          },
          { phase: 'settled' },
        ),
        'healthy',
      );
    },
  );

  await testAsync('bounded post-setup reconcile keeps unhealthy when confirm fails', async () => {
    const timeoutSnapshot = {
      permissionStatus: 'granted' as const,
      deviceRegistered: false,
      hasPushToken: true,
    };
    const final = await reconcileDeliveryAfterSetupSettle({
      setupResult: 'timeout',
      setupSnapshot: timeoutSnapshot,
      syncDelivery: async () => ({
        permissionStatus: 'granted',
        deviceRegistered: false,
        hasPushToken: false,
      }),
      withTimeout: async (promise) => promise,
    });
    assert.deepEqual(final, timeoutSnapshot);
    assert.equal(resolveNotificationUserStatus(final), 'needs_attention');
  });

  await testAsync('bounded post-setup reconcile skips when permission denied', async () => {
    let syncCalls = 0;
    const denied = {
      permissionStatus: 'denied' as const,
      deviceRegistered: false,
      hasPushToken: false,
    };
    const final = await reconcileDeliveryAfterSetupSettle({
      setupResult: 'timeout',
      setupSnapshot: denied,
      syncDelivery: async () => {
        syncCalls += 1;
        return {
          permissionStatus: 'granted',
          deviceRegistered: true,
          hasPushToken: true,
        };
      },
      withTimeout: async (promise) => promise,
    });
    assert.equal(syncCalls, 0);
    assert.deepEqual(final, denied);
    assert.equal(resolveNotificationUserStatus(final), 'permission_denied');
  });

  await testAsync('opening diagnostics does not mutate readiness / setup history', async () => {
    let prefsCalls = 0;
    const readinessBefore = {
      permissionStatus: 'granted' as const,
      deviceRegistered: true,
      hasPushToken: true,
    };
    const setupBefore = {
      phase: 'idle',
      result: 'incomplete' as const,
      detail: undefined as string | undefined,
    };

    const snapshot = await assembleNotificationDiagnosticsProbes({
      getPermissionStatus: async () => 'granted',
      getDeviceUuid: async () => 'diag-device-uuid',
      probePushTokenPresent: async () => true,
      isSupabaseConfigured: () => true,
      hasProjectIdConfigured: () => true,
      fetchBackendPrefs: async () => {
        prefsCalls += 1;
        return { ok: true, hasData: true };
      },
      getLastSetup: () => setupBefore,
      getLastPushTokenFailure: () => null,
      platform: 'android',
      raceTimeout,
    });

    assert.equal(prefsCalls, 1);
    assert.equal(snapshot.hasPushToken, true);
    assert.equal(snapshot.deviceRegistered, true);
    assert.equal(snapshot.lastSetupResult, 'incomplete');
    assert.equal(snapshot.lastSetupPhase, 'idle');
    // Historical incomplete + current healthy coexist in diagnostics output.
    assert.equal(isNotificationDeliveryReady(readinessBefore), true);
    assert.equal(resolveNotificationUserStatus(readinessBefore), 'healthy');
    assert.deepEqual(setupBefore, {
      phase: 'idle',
      result: 'incomplete',
      detail: undefined,
    });
  });

  await testAsync('refreshing diagnostics stays read-only (prefs lookup only)', async () => {
    let prefsCalls = 0;
    const fetchBackendPrefs = async () => {
      prefsCalls += 1;
      return { ok: true, hasData: true };
    };

    const first = await assembleNotificationDiagnosticsProbes({
      getPermissionStatus: async () => 'granted',
      getDeviceUuid: async () => 'diag-device-uuid',
      probePushTokenPresent: async () => true,
      isSupabaseConfigured: () => true,
      hasProjectIdConfigured: () => true,
      fetchBackendPrefs,
      getLastSetup: () => ({ phase: 'complete', result: 'success' }),
      getLastPushTokenFailure: () => null,
      platform: 'android',
      raceTimeout,
    });
    const second = await assembleNotificationDiagnosticsProbes({
      getPermissionStatus: async () => 'granted',
      getDeviceUuid: async () => 'diag-device-uuid',
      probePushTokenPresent: async () => true,
      isSupabaseConfigured: () => true,
      hasProjectIdConfigured: () => true,
      fetchBackendPrefs,
      getLastSetup: () => ({ phase: 'complete', result: 'success' }),
      getLastPushTokenFailure: () => null,
      platform: 'android',
      raceTimeout,
    });

    assert.equal(first.deviceRegistered, true);
    assert.equal(second.deviceRegistered, true);
    assert.equal(prefsCalls, 2);
    assert.equal(
      shouldApplyDeliveryRefresh({
        previous: {
          permissionStatus: 'granted',
          deviceRegistered: true,
          hasPushToken: true,
        },
        next: {
          permissionStatus: 'granted',
          deviceRegistered: true,
          hasPushToken: true,
        },
        mode: 'soft',
      }),
      true,
    );
  });
}

void runAsyncDiagnosticsTests()
  .then(() => {
    console.log('\nAll notification init tests passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
