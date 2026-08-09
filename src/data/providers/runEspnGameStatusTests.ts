import assert from 'node:assert/strict';

import {
  formatEspnGameStatusLabel,
  mapEspnStatusToNormalized,
  resolveEspnGameStatusPresentation,
  shouldPollEspnNormalizedStatus,
} from '@/data/providers/espnGameStatus';
import { hasLiveEspnNormalizedGames } from '@/data/scores/scoresLiveRefresh';
import type { EspnNormalizedGame } from '@/types';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

function sample(
  normalizedStatus: EspnNormalizedGame['normalizedStatus'],
  status: string,
): EspnNormalizedGame {
  return {
    id: '1',
    awayTeam: 'Away',
    homeTeam: 'Home',
    startTime: '2026-09-05T18:00:00Z',
    status,
    normalizedStatus,
  };
}

test('scheduled', () => {
  assert.equal(
    mapEspnStatusToNormalized({ state: 'pre', typeName: 'STATUS_SCHEDULED', description: 'Scheduled' }),
    'scheduled',
  );
  assert.equal(shouldPollEspnNormalizedStatus('scheduled'), false);
});

test('in_progress', () => {
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'in',
      typeName: 'STATUS_IN_PROGRESS',
      description: '3rd Quarter',
    }),
    'in_progress',
  );
  assert.equal(shouldPollEspnNormalizedStatus('in_progress'), true);
  assert.equal(
    resolveEspnGameStatusPresentation(sample('in_progress', '3rd · 4:12')).label,
    '3rd · 4:12',
  );
});

test('halftime stays in_progress and keeps polling', () => {
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'in',
      typeName: 'STATUS_HALFTIME',
      description: 'Halftime',
    }),
    'in_progress',
  );
  assert.equal(shouldPollEspnNormalizedStatus('in_progress'), true);
  assert.equal(formatEspnGameStatusLabel(sample('in_progress', 'Halftime')), 'Halftime');
});

test('overtime stays in_progress via state=in', () => {
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'in',
      typeName: 'STATUS_IN_PROGRESS',
      description: 'OT',
    }),
    'in_progress',
  );
  assert.equal(shouldPollEspnNormalizedStatus('in_progress'), true);
});

test('final', () => {
  assert.equal(
    mapEspnStatusToNormalized({ state: 'post', typeName: 'STATUS_FINAL', description: 'Final' }),
    'final',
  );
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'post',
      typeName: 'STATUS_FINAL_OVERTIME',
      description: 'Final/OT',
    }),
    'final',
  );
  assert.equal(shouldPollEspnNormalizedStatus('final'), false);
  assert.equal(resolveEspnGameStatusPresentation(sample('final', 'Final/OT')).kind, 'final');
});

test('delayed', () => {
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'pre',
      typeName: 'STATUS_DELAY',
      description: 'Delayed',
    }),
    'delayed',
  );
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'in',
      typeName: 'STATUS_RAIN_DELAY',
      description: 'Weather Delay',
    }),
    'delayed',
  );
  assert.equal(shouldPollEspnNormalizedStatus('delayed'), true);
  assert.equal(hasLiveEspnNormalizedGames([sample('delayed', 'Weather Delay')]), true);
  assert.equal(formatEspnGameStatusLabel(sample('delayed', 'Weather Delay')), 'Weather Delay');
});

test('postponed is not final', () => {
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'post',
      typeName: 'STATUS_POSTPONED',
      description: 'Postponed',
    }),
    'postponed',
  );
  assert.equal(shouldPollEspnNormalizedStatus('postponed'), false);
  assert.notEqual(
    mapEspnStatusToNormalized({
      state: 'post',
      typeName: 'STATUS_POSTPONED',
      description: 'Postponed',
    }),
    'final',
  );
  assert.equal(resolveEspnGameStatusPresentation(sample('postponed', 'Postponed')).kind, 'special');
});

test('suspended', () => {
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'in',
      typeName: 'STATUS_SUSPENDED',
      description: 'Suspended',
    }),
    'suspended',
  );
  assert.equal(shouldPollEspnNormalizedStatus('suspended'), true);
});

test('cancelled is not final', () => {
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'post',
      typeName: 'STATUS_CANCELED',
      description: 'Cancelled',
    }),
    'cancelled',
  );
  assert.equal(
    mapEspnStatusToNormalized({
      state: 'post',
      typeName: 'STATUS_CANCELLED',
      description: 'Canceled',
    }),
    'cancelled',
  );
  assert.equal(shouldPollEspnNormalizedStatus('cancelled'), false);
  assert.equal(resolveEspnGameStatusPresentation(sample('cancelled', 'Cancelled')).kind, 'special');
});

console.log('\nAll ESPN game status tests passed.');
