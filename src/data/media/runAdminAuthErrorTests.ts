/**
 * Admin Auth error mapping tests.
 * Run: npm.cmd run test:admin-auth-errors
 */

import assert from 'node:assert/strict';

import {
  formatAdminSignInError,
  isInvalidCredentialsFailure,
  isNetworkAuthFailure,
} from '@/data/media/adminAuthErrors';

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
  test('network TypeError maps to connection message', () => {
    assert.equal(isNetworkAuthFailure('Network request failed'), true);
    assert.equal(
      formatAdminSignInError(new TypeError('Network request failed'), 'sign_in'),
      'Could not reach FCS Pulse services. Check your connection and try again.',
    );
  });

  test('invalid credentials map cleanly', () => {
    assert.equal(isInvalidCredentialsFailure('Invalid login credentials'), true);
    assert.equal(
      formatAdminSignInError(new Error('Invalid login credentials'), 'sign_in'),
      'Incorrect email or password.',
    );
  });

  test('not allowlisted admin message', () => {
    assert.equal(
      formatAdminSignInError(null, 'admin_check'),
      'This account does not have administrator access.',
    );
  });

  test('raw TypeError text is not shown', () => {
    const message = formatAdminSignInError(new TypeError('Network request failed'));
    assert.doesNotMatch(message, /TypeError/i);
    assert.match(message, /could not reach/i);
  });

  console.log('\nAll admin auth error tests passed.');
}

main();
