/**
 * Compact kickoff date label tests.
 * Run: npm.cmd run test:format-game-time
 */

import assert from 'node:assert/strict';

import {
  formatGameKickoffDateCompact,
  toCompactKickoffDateLabel,
} from '@/utils/formatGameTime';

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
  test('strips weekday, long month, and ordinal', () => {
    assert.equal(toCompactKickoffDateLabel('Sat, September 6th'), 'Sep 6');
    assert.equal(toCompactKickoffDateLabel('Sat, August 29th'), 'Aug 29');
    assert.equal(toCompactKickoffDateLabel('Saturday, September 13th'), 'Sep 13');
  });

  test('keeps already-short dates', () => {
    assert.equal(toCompactKickoffDateLabel('Sep 20'), 'Sep 20');
    assert.equal(toCompactKickoffDateLabel('Aug 29'), 'Aug 29');
  });

  test('TBD unchanged', () => {
    assert.equal(toCompactKickoffDateLabel('TBD'), 'TBD');
    assert.equal(toCompactKickoffDateLabel(''), 'TBD');
  });

  test('ISO fallback formats compact without weekday clutter', () => {
    // ESPN Eastern: afternoon UTC often lands same calendar day ET.
    const label = formatGameKickoffDateCompact({
      startTime: '2026-09-13T23:30:00Z',
    });
    assert.match(label, /^Sep \d{1,2}$/);
    assert.doesNotMatch(label, /Sat|September|th\b/i);
  });

  console.log('\nAll formatGameTime tests passed.');
}

main();
