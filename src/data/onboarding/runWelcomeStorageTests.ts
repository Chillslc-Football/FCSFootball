/**
 * Version 1 welcome flag helpers.
 * Run: npm.cmd run test:welcome-storage
 */

import assert from 'node:assert/strict';

import {
  WELCOME_V1_COMPLETE_KEY,
  parseWelcomeCompleteFlag,
} from '@/data/onboarding/welcomeStorage';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

test('welcome key is versioned for future onboarding', () => {
  assert.equal(WELCOME_V1_COMPLETE_KEY, 'fcs_pulse_welcome_v1_complete');
  assert.match(WELCOME_V1_COMPLETE_KEY, /_v1_/);
});

test('parse welcome complete flag', () => {
  assert.equal(parseWelcomeCompleteFlag('1'), true);
  assert.equal(parseWelcomeCompleteFlag('true'), true);
  assert.equal(parseWelcomeCompleteFlag(null), false);
  assert.equal(parseWelcomeCompleteFlag(undefined), false);
  assert.equal(parseWelcomeCompleteFlag('0'), false);
  assert.equal(parseWelcomeCompleteFlag('false'), false);
  assert.equal(parseWelcomeCompleteFlag(''), false);
});

console.log('\nAll welcome storage tests passed.');
