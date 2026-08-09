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
import { getNotificationUserStatusView } from '@/data/notifications/notificationUserStatus';
import type { NotificationPermissionStatus } from '@/data/notifications/types';

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
    ...overrides,
  };
}

async function main(): Promise<void> {
  await test('1. readiness succeeds → complete success diagnostic', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt({ requestPermission: true }, createDeps());
    assert.equal(result.result, 'success');
    assert.equal(result.hasPushToken, true);
    assert.equal(result.registered, true);
    assert.equal(getLastNotificationSetupDiagnostic().phase, 'complete');
    assert.equal(getLastNotificationSetupDiagnostic().result, 'success');
  });

  await test('2. push token call rejects → spinner-equivalent settles + incomplete', async () => {
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

  await test('3. push token never resolves → overall timeout settles', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true, timeoutMs: 40 },
      createDeps({
        requestPermissionAndToken: () => neverResolve(),
      }),
    );
    assert.equal(result.result, 'timeout');
    assert.match(result.detail ?? '', /timed out/i);
    assert.equal(getLastNotificationSetupDiagnostic().result, 'timeout');
  });

  await test('4. register_device rejects → settles + retryable incomplete/error', async () => {
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

  await test('5. register_device never resolves → timeout + queue-equivalent race settles', async () => {
    resetNotificationSetupDiagnosticForTests();
    const result = await runNotificationSetupAttempt(
      { requestPermission: true, timeoutMs: 40 },
      createDeps({
        registerDevice: () => neverResolve(),
      }),
    );
    assert.equal(result.result, 'timeout');

    // Direct queue-style write timeout.
    await assert.rejects(
      () => raceTimeout(neverResolve(), 20, 'Device registration timed out'),
      /Device registration timed out/,
    );
  });

  await test('6. second retry works after first failure', async () => {
    resetNotificationSetupDiagnosticForTests();
    let tokenCalls = 0;
    const deps = createDeps({
      requestPermissionAndToken: async () => {
        tokenCalls += 1;
        if (tokenCalls === 1) throw new Error('temporary token failure');
        return 'ExponentPushToken[retry]';
      },
    });

    const first = await runNotificationSetupAttempt({ requestPermission: true }, deps);
    assert.equal(first.hasPushToken, false);

    const second = await runNotificationSetupAttempt({ requestPermission: true }, deps);
    assert.equal(second.result, 'success');
    assert.equal(second.hasPushToken, true);
    assert.equal(tokenCalls, 2);
  });

  await test('7. concurrent taps do not start duplicate attempts (guard contract)', async () => {
    // Mirrors useNotificationPreferences setupInFlightRef behavior.
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

  await test('8. stale attempt cannot overwrite newer attempt', async () => {
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

    // Older slow attempt (null token) vs newer fast success.
    const slow = runAttempt(null, 40);
    const fast = runAttempt('ExponentPushToken[new]', 5);
    await Promise.all([slow, fast]);
    assert.equal(appliedHasToken, true);
    assert.equal(appliedAttempt, currentAttempt);
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
