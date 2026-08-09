import assert from 'node:assert/strict';

import {
  getScoresWeekTitle,
  getScheduleWeekMeta,
  resolveCurrentScoresWeekId,
} from '@/data/providers/espnScheduleWeek';
import {
  queueScoresFilterHandoff,
  queueScoresWeekHandoff,
  resetScoresFilterHandoffForTests,
  takeScoresFilterHandoff,
} from '@/data/scores/scoresFilterHandoff';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

function atNoonLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

test('Week 1 date resolves to week-1', () => {
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal('2026-09-03')), 'week-1');
});

test('Week 2 date resolves to week-2', () => {
  const week2 = getScheduleWeekMeta('week-2');
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal(week2.startDateIso)), 'week-2');
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal(week2.endDateIso)), 'week-2');
});

test('midseason date resolves to week-8', () => {
  const week8 = getScheduleWeekMeta('week-8');
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal(week8.startDateIso)), 'week-8');
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal(week8.endDateIso)), 'week-8');
});

test('playoff Round 1 date resolves to week-13', () => {
  const round1 = getScheduleWeekMeta('week-13');
  assert.equal(getScoresWeekTitle('week-13'), 'Playoffs Round 1');
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal(round1.startDateIso)), 'week-13');
});

test('championship date resolves to week-17', () => {
  const championship = getScheduleWeekMeta('week-17');
  assert.equal(getScoresWeekTitle('week-17'), 'National Championship');
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal(championship.endDateIso)), 'week-17');
});

test('preseason falls back to week-1', () => {
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal('2026-08-01')), 'week-1');
});

test('opening weekend (Week 0 dates) maps to visible week-1', () => {
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal('2026-08-28')), 'week-1');
});

test('Mon–Tue gap after Week 1 advances to upcoming Week 2', () => {
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal('2026-09-07')), 'week-2');
});

test('Home Quick Link filter handoff has no week (Scores applies current week)', () => {
  resetScoresFilterHandoffForTests();
  queueScoresFilterHandoff('fcs-top-25');
  const handoff = takeScoresFilterHandoff();
  assert.ok(handoff);
  assert.equal(handoff.filterId, 'fcs-top-25');
  assert.equal(handoff.weekId, undefined);
  // Scores focus path: no weekId → resolveCurrentScoresWeekId()
  assert.equal(resolveCurrentScoresWeekId(atNoonLocal('2026-10-01')), 'week-5');
});

test('explicit week handoff wins over current week', () => {
  resetScoresFilterHandoffForTests();
  const current = resolveCurrentScoresWeekId(atNoonLocal('2026-10-01'));
  assert.equal(current, 'week-5');
  queueScoresWeekHandoff('week-3');
  const handoff = takeScoresFilterHandoff();
  assert.ok(handoff);
  assert.equal(handoff.weekId, 'week-3');
  assert.notEqual(handoff.weekId, current);
});

test('explicit week + filter handoff preserves both', () => {
  resetScoresFilterHandoffForTests();
  queueScoresFilterHandoff('fcs-vs-fbs', { weekId: 'week-3' });
  const handoff = takeScoresFilterHandoff();
  assert.ok(handoff);
  assert.equal(handoff.filterId, 'fcs-vs-fbs');
  assert.equal(handoff.weekId, 'week-3');
});

console.log('\nAll ESPN schedule week tests passed.');
