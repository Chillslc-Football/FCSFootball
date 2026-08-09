import assert from 'node:assert/strict';

import {
  createScoresRequestGeneration,
  resolveScoresVisibleUpdate,
  type ScoresFetchContext,
} from '@/data/scores/scoresRequestGuard';
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

function game(id: string): EspnNormalizedGame {
  return {
    id,
    awayTeam: 'Away',
    homeTeam: 'Home',
    startTime: '2026-09-05T18:00:00Z',
    status: 'Scheduled',
    normalizedStatus: 'scheduled',
  };
}

const week2: ScoresFetchContext = { weekId: 'week-2', leagueFilter: 'fcs' };
const week3: ScoresFetchContext = { weekId: 'week-3', leagueFilter: 'fcs' };
const filterAll: ScoresFetchContext = { weekId: 'week-5', leagueFilter: 'all' };
const filterFcs: ScoresFetchContext = { weekId: 'week-5', leagueFilter: 'fcs' };

test('A: non-empty board + transient empty refresh preserves previous board', () => {
  const previous = [game('a'), game('b')];
  const update = resolveScoresVisibleUpdate({
    isCurrent: true,
    fetchedGames: [],
    previousGames: previous,
    previousContext: week2,
    requestContext: week2,
  });
  assert.equal(update.type, 'preserve');
  assert.equal(update.type === 'preserve' && update.reason, 'empty_refresh');
});

test('B: initial legitimate empty week applies empty', () => {
  const update = resolveScoresVisibleUpdate({
    isCurrent: true,
    fetchedGames: [],
    previousGames: [],
    previousContext: null,
    requestContext: week2,
  });
  assert.deepEqual(update, { type: 'apply', games: [] });
});

test('B2: new week/filter with empty result does not keep prior week board', () => {
  const update = resolveScoresVisibleUpdate({
    isCurrent: true,
    fetchedGames: [],
    previousGames: [game('week2-game')],
    previousContext: week2,
    requestContext: week3,
  });
  assert.deepEqual(update, { type: 'apply', games: [] });
});

test('C: Week 3 wins when Week 2 finishes late', () => {
  const gen = createScoresRequestGeneration();
  const week2Token = gen.bump();
  const week3Token = gen.bump();

  const week3Games = [game('w3')];
  const week3Update = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(week3Token),
    fetchedGames: week3Games,
    previousGames: [],
    previousContext: null,
    requestContext: week3,
  });
  assert.deepEqual(week3Update, { type: 'apply', games: week3Games });

  const week2Update = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(week2Token),
    fetchedGames: [game('w2')],
    previousGames: week3Games,
    previousContext: week3,
    requestContext: week2,
  });
  assert.deepEqual(week2Update, { type: 'ignore', reason: 'stale' });
  assert.equal(gen.isCurrent(week3Token), true);
  assert.equal(gen.isCurrent(week2Token), false);
});

test('D: Filter B wins; old Filter A response ignored', () => {
  const gen = createScoresRequestGeneration();
  const filterAToken = gen.bump();
  const filterBToken = gen.bump();

  const filterBGames = [game('all-1')];
  const bUpdate = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(filterBToken),
    fetchedGames: filterBGames,
    previousGames: [],
    previousContext: null,
    requestContext: filterAll,
  });
  assert.deepEqual(bUpdate, { type: 'apply', games: filterBGames });

  const aUpdate = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(filterAToken),
    fetchedGames: [game('fcs-old')],
    previousGames: filterBGames,
    previousContext: filterAll,
    requestContext: filterFcs,
  });
  assert.deepEqual(aUpdate, { type: 'ignore', reason: 'stale' });
});

test('E: current-context live refresh still updates normally', () => {
  const gen = createScoresRequestGeneration();
  const token = gen.bump();
  const previous = [game('old-score')];
  const next = [game('new-score')];

  const update = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(token),
    fetchedGames: next,
    previousGames: previous,
    previousContext: week2,
    requestContext: week2,
  });
  assert.deepEqual(update, { type: 'apply', games: next });
});

test('same-context newer refresh supersedes older in-flight', () => {
  const gen = createScoresRequestGeneration();
  const older = gen.bump();
  const newer = gen.bump();
  assert.equal(gen.isCurrent(newer), true);
  assert.equal(gen.isCurrent(older), false);

  const ignored = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(older),
    fetchedGames: [game('stale')],
    previousGames: [],
    previousContext: null,
    requestContext: week2,
  });
  assert.equal(ignored.type, 'ignore');
});

console.log('\nAll Scores request-guard tests passed.');
