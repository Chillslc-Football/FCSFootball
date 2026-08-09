/**
 * App release policy decision / store / Expo Go tests.
 * Run: npm.cmd run test:app-release-policy
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = true;

import assert from 'node:assert/strict';

import {
  isExpoGoClientFromConstants,
  shouldEnforceReleasePolicyFromConstants,
} from '@/data/release/releasePolicyEnv';
import { isReleasePolicyCacheFresh } from '@/data/release/releasePolicyTtl';
import {
  applyReleasePolicySimulation,
  clearReleasePolicySimulation,
  setReleasePolicySimulation,
} from '@/data/release/releasePolicySimulation';
import { resolveAppUpdateState } from '@/data/release/resolveAppUpdateState';
import { resolveStoreOpenPlan } from '@/data/release/storeOpenPlan';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

function main(): void {
  test('1: installed == latest == minimum → current', () => {
    const decision = resolveAppUpdateState({
      platform: 'ios',
      installedBuild: 6,
      latestBuild: 6,
      minimumSupportedBuild: 6,
    });
    assert.equal(decision.state, 'current');
    assert.equal(decision.failOpen, false);
  });

  test('2: installed below latest but >= minimum → optional', () => {
    const decision = resolveAppUpdateState({
      platform: 'android',
      installedBuild: 8,
      latestBuild: 9,
      minimumSupportedBuild: 8,
    });
    assert.equal(decision.state, 'optional_update');
  });

  test('3: installed below minimum → required', () => {
    const decision = resolveAppUpdateState({
      platform: 'ios',
      installedBuild: 5,
      latestBuild: 6,
      minimumSupportedBuild: 6,
    });
    assert.equal(decision.state, 'required_update');
  });

  test('4: iOS and Android policies independent', () => {
    const ios = resolveAppUpdateState({
      platform: 'ios',
      installedBuild: 5,
      latestBuild: 6,
      minimumSupportedBuild: 6,
    });
    const android = resolveAppUpdateState({
      platform: 'android',
      installedBuild: 8,
      latestBuild: 9,
      minimumSupportedBuild: 8,
    });
    assert.equal(ios.state, 'required_update');
    assert.equal(android.state, 'optional_update');
  });

  test('5: malformed build values → fail open', () => {
    assert.equal(
      resolveAppUpdateState({
        platform: 'ios',
        installedBuild: Number.NaN,
        latestBuild: 6,
        minimumSupportedBuild: 6,
      }).state,
      'current',
    );
    assert.equal(
      resolveAppUpdateState({
        platform: 'ios',
        installedBuild: 5,
        latestBuild: 0,
        minimumSupportedBuild: 1,
      }).failOpen,
      true,
    );
    assert.equal(
      resolveAppUpdateState({
        platform: 'ios',
        installedBuild: 5,
        latestBuild: 4,
        minimumSupportedBuild: 6,
      }).state,
      'current',
    );
  });

  test('6: missing policy fields → fail open', () => {
    const decision = resolveAppUpdateState({
      platform: 'android',
      installedBuild: 4,
      latestBuild: null,
      minimumSupportedBuild: undefined,
    });
    assert.equal(decision.state, 'current');
    assert.equal(decision.failOpen, true);
  });

  test('7: remote failure modeled as no enforcement (fail open)', () => {
    const decision = resolveAppUpdateState({
      platform: 'ios',
      installedBuild: 1,
      latestBuild: null,
      minimumSupportedBuild: null,
    });
    assert.equal(decision.state, 'current');
    assert.equal(decision.failOpen, true);
  });

  test('8: Expo Go / storeClient enforcement bypass', () => {
    assert.equal(
      isExpoGoClientFromConstants({ appOwnership: 'expo', executionEnvironment: 'storeClient' }),
      true,
    );
    assert.equal(
      shouldEnforceReleasePolicyFromConstants({
        appOwnership: 'expo',
        executionEnvironment: 'storeClient',
      }),
      false,
    );
    assert.equal(
      shouldEnforceReleasePolicyFromConstants({
        appOwnership: null,
        executionEnvironment: 'standalone',
      }),
      true,
    );
  });

  test('9: required update has no dismiss path in decision state', () => {
    const required = resolveAppUpdateState({
      platform: 'ios',
      installedBuild: 1,
      latestBuild: 2,
      minimumSupportedBuild: 2,
    });
    assert.equal(required.state, 'required_update');
  });

  test('10: optional simulation can be cleared (dismiss/clear path)', () => {
    setReleasePolicySimulation('optional_update');
    assert.equal(
      applyReleasePolicySimulation('current', { allowSimulation: true }),
      'optional_update',
    );
    clearReleasePolicySimulation();
    assert.equal(applyReleasePolicySimulation('current', { allowSimulation: true }), 'current');
  });

  test('11: correct store destination selected by platform', () => {
    const android = resolveStoreOpenPlan({
      platform: 'android',
      storeUrl: 'https://play.google.com/store/apps/details?id=com.chillslc.fcsfootball',
      applicationId: 'com.chillslc.fcsfootball',
    });
    assert.equal(android.nativeUrl, 'market://details?id=com.chillslc.fcsfootball');
    assert.match(android.httpsUrl ?? '', /play\.google\.com/);

    const iosConfigured = resolveStoreOpenPlan({
      platform: 'ios',
      storeUrl: 'https://apps.apple.com/app/fcs-pulse/id1234567890',
    });
    assert.equal(iosConfigured.nativeUrl, 'itms-apps://itunes.apple.com/app/id1234567890');
    assert.ok(iosConfigured.httpsUrl?.includes('apps.apple.com'));

    const iosMissing = resolveStoreOpenPlan({
      platform: 'ios',
      storeUrl: '',
    });
    assert.equal(iosMissing.nativeUrl, null);
    assert.equal(iosMissing.httpsUrl, null);
  });

  test('cache TTL helper', () => {
    const now = 1_000_000;
    assert.equal(isReleasePolicyCacheFresh(now - 1000, now, 5000), true);
    assert.equal(isReleasePolicyCacheFresh(now - 6000, now, 5000), false);
  });

  console.log('\nAll app release policy tests passed.');
}

main();
