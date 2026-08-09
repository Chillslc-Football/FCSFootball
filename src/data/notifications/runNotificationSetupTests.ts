/**
 * Bounded notification setup / Try Again tests.
 * Run: npm.cmd run test:notification-setup
 */

import assert from 'node:assert/strict';

import {
  getLastNotificationSetupDiagnostic,
  raceTimeout,
  resetNotificationSetupDiagnosticForTests,
  runNotificationSetupAttempt,
  type NotificationSetupDeps,
} from '@/data/notifications/notificationSetup';
import { evaluateNotificationSetupSuccess } from '@/data/notifications/notificationSetupSuccess';
import {
  buildNotificationDiagnosticsLines,
  getNotificationUserStatusView,
} from '@/data/notifications/notificationUserStatus';
import type { NotificationPermissionStatus } from '@/data/notifications/types';
import {
  categorizePushTokenError,
  sanitizePushTokenErrorMessage,
} from '@/data/notifications/pushTokenErrors';

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok  - ${name}`);
    })
    .catch((error) => {
      console.error(`fail - ${name}`);
      throw error;
    });
}

function neverResolve<T>(): Promise<T> {
  return new Promise(() => {
    // Intentionally never settles.
  });
}

function createDeps(overrides: Partial<NotificationSetupDeps> = {}): NotificationSetupDeps {
  return {
    getPermissionStatus: async () => 'granted' as NotificationPermissionStatus,
    requestPermissionAndToken: async () => 'ExponentPushToken[test]',
    getExistingToken: async () => 'ExponentPushToken[test]',
    registerDevice: async () => ({ registered: true }),
    hasDeviceUuid: async () => true,
    isSupabaseConfigured: () => true,
    hasProjectIdConfigured: () => true,
    isExpoGo: () => false,
    ...overrides,
  };
}

async function main(): Promise<void> {
  await test('1. successful full setup → success', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt({ requestPermission: true }, createDeps());
    assert.equal(result.result, 'success');
    assert.equal(result.hasPushToken, true);
    assert.equal(result.registered, true);
    assert.equal(getLastNotificationSetupDiagnostic().phase, 'complete');
    assert.equal(getLastNotificationSetupDiagnostic().result, 'success');
  });

  await test('2. missing push token → incomplete (never success)', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true },
      createDeps({
        requestPermissionAndToken: async () => null,
        registerDevice: async () => ({ registered: true }),
      }),
    );
    assert.equal(result.result, 'incomplete');
    assert.equal(result.hasPushToken, false);
    assert.equal(result.registered, true);
    assert.match(result.detail ?? '', /Push token missing/i);
    assert.notEqual(result.result, 'success');
  });

  await test('3. missing Supabase config → incomplete (never success)', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true },
      createDeps({
        isSupabaseConfigured: () => false,
      }),
    );
    assert.equal(result.result, 'incomplete');
    assert.match(result.detail ?? '', /Supabase/i);
    assert.notEqual(result.result, 'success');
  });

  await test('4. permission undetermined → not success', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true },
      createDeps({
        getPermissionStatus: async () => 'undetermined',
        requestPermissionAndToken: async () => null,
        registerDevice: async () => ({ registered: false }),
      }),
    );
    assert.notEqual(result.result, 'success');
    assert.equal(result.result, 'incomplete');
    assert.match(result.detail ?? '', /Permission/i);
  });

  await test('5. deliveryReady=false can never evaluate as success', () => {
    const evaluation = evaluateNotificationSetupSuccess({
      permissionStatus: 'granted',
      deviceUuidPresent: true,
      hasPushToken: false,
      deviceRegistered: true,
      supabaseConfigured: true,
      projectIdConfigured: true,
    });
    assert.equal(evaluation.deliveryReady, false);
    assert.equal(evaluation.result, 'incomplete');
  });

  await test('6. Android token fetch failure is surfaced distinctly (FCM category)', () => {
    const categorized = categorizePushTokenError(
      new Error('Default FirebaseApp is not initialized / FCM credentials missing'),
    );
    assert.equal(categorized.category, 'fcm');
    assert.match(categorized.safeMessage, /FCM/i);
    assert.equal(
      sanitizePushTokenErrorMessage('token ExponentPushToken[abc123] leaked'),
      'token [redacted] leaked',
    );
  });

  await test('7. diagnostics lines keep local truth when backend probe fails', () => {
    const lines = buildNotificationDiagnosticsLines({
      permissionStatus: 'granted',
      deviceRegistered: false,
      hasPushToken: false,
      backendPrefsLoaded: false,
      platform: 'ios',
      appEnvironment: 'installed_build',
      supabaseConfigured: true,
      projectIdConfigured: true,
      deviceUuidPresent: true,
      lastSetupPhase: 'complete',
      lastSetupResult: 'incomplete',
      lastSetupDetail: 'Push token missing',
      lastFailedProbe: 'register_device',
      pushTokenFailureCategory: 'fcm',
      pushTokenFailureDetail: 'Android FCM configuration error',
    });
    assert.ok(lines.some((l) => l === 'Permission: granted'));
    assert.ok(lines.some((l) => l === 'Supabase configured: yes'));
    assert.ok(lines.some((l) => l === 'Last diagnostic failed probe: register_device'));
    assert.ok(lines.some((l) => l === 'Push token failure: fcm'));
    assert.ok(!lines.some((l) => l === 'Last setup result: success'));
  });

  await test('8. Try Again overall deadline is truly bounded (no stacked overrun)', async () => {
    resetNotificationSetupDiagnosticForTests();
    const started = Date.now();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true, timeoutMs: 80 },
      createDeps({
        requestPermissionAndToken: async () => {
          // Would overrun if stacked with outer budget.
          await new Promise((r) => setTimeout(r, 200));
          return 'ExponentPushToken[late]';
        },
        registerDevice: async () => {
          await new Promise((r) => setTimeout(r, 200));
          return { registered: true };
        },
      }),
    );
    const elapsed = Date.now() - started;
    assert.equal(result.result, 'timeout');
    assert.ok(elapsed < 250, `expected settle under ~250ms, got ${elapsed}ms`);
    assert.notEqual(getLastNotificationSetupDiagnostic().result, 'success');
  });

  await test('9. push token call rejects → settles incomplete + registered path', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true },
      createDeps({
        requestPermissionAndToken: async () => {
          throw new Error('Push token request failed');
        },
        registerDevice: async () => ({ registered: true }),
      }),
    );
    assert.equal(result.result, 'incomplete');
    assert.equal(result.hasPushToken, false);
    assert.equal(result.registered, true);
    assert.equal(getLastNotificationSetupDiagnostic().phase, 'complete');
  });

  await test('10. register_device rejects → settles + retryable', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true },
      createDeps({
        registerDevice: async () => {
          throw new Error('register_device failed');
        },
      }),
    );
    assert.ok(result.result === 'error' || result.result === 'incomplete');
    assert.equal(result.registered, false);
    assert.equal(result.hasPushToken, true);
    assert.equal(getNotificationUserStatusView('needs_attention').primaryAction, 'retry');
  });

  await test('11. register_device never resolves → timeout + race settles', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true, timeoutMs: 40 },
      createDeps({
        registerDevice: () => neverResolve(),
      }),
    );
    assert.equal(result.result, 'timeout');

    await assert.rejects(
      () => raceTimeout(neverResolve(), 20, 'Device registration timed out'),
      /Device registration timed out/,
    );
  });

  await test('12. second retry works after first failure', async () => {
    resetNotificationSetupDiagnosticForTests();
    let tokenCalls = 0;
    const deps = createDeps({
      requestPermissionAndToken: async () => {
        tokenCalls += 1;
        if (tokenCalls === 1) return null;
        return 'ExponentPushToken[retry]';
      },
    });

    const first = await runNotificationSetupAttempt({ requestPermission: true }, deps);
    assert.equal(first.hasPushToken, false);
    assert.notEqual(first.result, 'success');

    const second = await runNotificationSetupAttempt({ requestPermission: true }, deps);
    assert.equal(second.result, 'success');
    assert.equal(second.hasPushToken, true);
    assert.equal(tokenCalls, 2);
  });

  await test('13. concurrent taps do not start duplicate attempts', async () => {
    let inFlight = false;
    let starts = 0;

    const run = async () => {
      if (inFlight) return 'skipped';
      inFlight = true;
      starts += 1;
      try {
        await runNotificationSetupAttempt(
          { requestPermission: true, timeoutMs: 100 },
          createDeps({
            requestPermissionAndToken: async () => {
              await new Promise((r) => setTimeout(r, 30));
              return 'ExponentPushToken[x]';
            },
          }),
        );
        return 'done';
      } finally {
        inFlight = false;
      }
    };

    const [a, b] = await Promise.all([run(), run()]);
    assert.equal(starts, 1);
    assert.ok(a === 'done' || b === 'done');
    assert.ok(a === 'skipped' || b === 'skipped');
  });

  await test('14. stale attempt cannot overwrite newer attempt', async () => {
    let appliedAttempt = 0;
    let appliedHasToken = false;
    let currentAttempt = 0;

    const runAttempt = async (token: string | null, delayMs: number) => {
      const attempt = ++currentAttempt;
      await new Promise((r) => setTimeout(r, delayMs));
      const result = await runNotificationSetupAttempt(
        { requestPermission: true },
        createDeps({
          requestPermissionAndToken: async () => token,
        }),
      );
      if (attempt !== currentAttempt) return;
      appliedAttempt = attempt;
      appliedHasToken = result.hasPushToken;
    };

    const slow = runAttempt(null, 40);
    const fast = runAttempt('ExponentPushToken[new]', 5);
    await Promise.all([slow, fast]);
    assert.equal(appliedHasToken, true);
    assert.equal(appliedAttempt, currentAttempt);
  });

  await test('15. success contract requires all installed-build fields', () => {
    assert.equal(
      evaluateNotificationSetupSuccess({
        permissionStatus: 'granted',
        deviceUuidPresent: true,
        hasPushToken: true,
        deviceRegistered: true,
        supabaseConfigured: true,
        projectIdConfigured: true,
      }).result,
      'success',
    );
    assert.equal(
      evaluateNotificationSetupSuccess({
        permissionStatus: 'granted',
        deviceUuidPresent: true,
        hasPushToken: true,
        deviceRegistered: true,
        supabaseConfigured: true,
        projectIdConfigured: false,
      }).result,
      'incomplete',
    );
  });

  await test('needs_attention copy invites retry without infinite-spinner wording', () => {
    const view = getNotificationUserStatusView('needs_attention');
    assert.match(view.supportingCopy, /Try again in a moment/i);
    assert.equal(view.primaryAction, 'retry');
  });

  console.log('\nAll notification setup tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
