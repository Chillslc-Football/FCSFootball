/**
 * Team schedule compact name helper tests.
 * Run: npm.cmd run test:team-display
 */

import assert from 'node:assert/strict';

import {
  getTeamScheduleCompactName,
  isReadableScheduleTeamLabel,
} from '@/utils/teamDisplay';

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
  test('prefers shortDisplayName when readable', () => {
    assert.equal(
      getTeamScheduleCompactName({
        shortDisplayName: 'Tarleton',
        location: 'Tarleton State',
        abbreviation: 'TAR',
        displayName: 'Tarleton State Texans',
      }),
      'Tarleton',
    );
    assert.equal(
      getTeamScheduleCompactName({
        shortDisplayName: 'Austin Peay',
        location: 'Austin Peay',
        abbreviation: 'APSU',
        displayName: 'Austin Peay Governors',
      }),
      'Austin Peay',
    );
  });

  test('falls back to location (school without mascot)', () => {
    assert.equal(
      getTeamScheduleCompactName({
        location: 'Montana State',
        abbreviation: 'MTST',
        displayName: 'Montana State Bobcats',
      }),
      'Montana State',
    );
    assert.equal(
      getTeamScheduleCompactName({
        shortDisplayName: 'MTST',
        location: 'Bowling Green',
        abbreviation: 'BGSU',
        displayName: 'Bowling Green Falcons',
      }),
      'Bowling Green',
    );
  });

  test('skips bare abbreviations', () => {
    assert.equal(isReadableScheduleTeamLabel('MTST', 'MTST'), false);
    assert.equal(isReadableScheduleTeamLabel('TAR', 'TAR'), false);
    assert.equal(isReadableScheduleTeamLabel('Montana St', 'MTST'), true);

    assert.equal(
      getTeamScheduleCompactName({
        shortDisplayName: 'WGA',
        abbreviation: 'WGA',
        displayName: 'West Georgia Wolves',
      }),
      'West Georgia Wolves',
    );
  });

  test('displayName is last resort', () => {
    assert.equal(
      getTeamScheduleCompactName({
        displayName: 'Central Arkansas Bears',
      }),
      'Central Arkansas Bears',
    );
  });

  test('West Georgia / Central Arkansas via short or location', () => {
    assert.equal(
      getTeamScheduleCompactName({
        shortDisplayName: 'West Georgia',
        location: 'West Georgia',
        displayName: 'West Georgia Wolves',
      }),
      'West Georgia',
    );
    assert.equal(
      getTeamScheduleCompactName({
        location: 'Central Arkansas',
        displayName: 'Central Arkansas Bears',
      }),
      'Central Arkansas',
    );
  });

  console.log('\nAll teamDisplay tests passed.');
}

main();
