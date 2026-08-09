import assert from 'node:assert/strict';

import {
  buildScoresLoadContextKey,
  shouldSkipScoresFocusRefresh,
} from '@/data/scores/scoresRefreshCoalesce';
import {
  hasLiveEspnNormalizedGames,
  SCORES_LIVE_REFRESH_INTERVAL_MS,
  shouldRunScoresLiveInterval,
} from '@/data/scores/scoresLiveRefresh';
import {
  mergeWeekGamesIntoSeason,
  resolveSeasonRefreshMode,
} from '@/data/teams/seasonGamesRefresh';
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

function game(id: string, status: EspnNormalizedGame['normalizedStatus'] = 'scheduled'): EspnNormalizedGame {
  return {
    id,
    awayTeam: 'Away',
    homeTeam: 'Home',
    startTime: '2026-09-05T18:00:00Z',
    status: status === 'in_progress' ? 'In Progress' : 'Scheduled',
    normalizedStatus: status,
  };
}

test('1. Scores focus coalesces after same-context week-or-filter load', () => {
  const key = buildScoresLoadContextKey('week-1', 'fcs');
  assert.equal(
    shouldSkipScoresFocusRefresh({
      trigger: 'scores-focus',
      contextKey: key,
      lastLoadKey: key,
      lastLoadAtMs: 1_000,
      nowMs: 2_500,
      coalesceWindowMs: 3_000,
    }),
    true,
  );
  assert.equal(
    shouldSkipScoresFocusRefresh({
      trigger: 'scores-focus',
      contextKey: key,
      lastLoadKey: key,
      lastLoadAtMs: 1_000,
      nowMs: 5_000,
      coalesceWindowMs: 3_000,
    }),
    false,
  );
  assert.equal(
    shouldSkipScoresFocusRefresh({
      trigger: 'scores-week-or-filter',
      contextKey: key,
      lastLoadKey: key,
      lastLoadAtMs: 1_000,
      nowMs: 1_500,
    }),
    false,
  );
});

test('2. Home live refresh mode is current-week, not full season', () => {
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'favorites-live-poll',
      currentWeekOnly: true,
      hasSeasonCache: true,
    }),
    'current-week',
  );
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'favorites-live-poll',
      hasSeasonCache: true,
    }),
    'current-week',
  );
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'favorites-ptr',
      pullRefresh: true,
      currentWeekOnly: true,
      hasSeasonCache: true,
    }),
    'season',
  );
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'favorites-focus',
      hasSeasonCache: false,
    }),
    'season',
  );
});

test('3. Team live refresh mode is current-week when cache exists', () => {
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'team-live-poll',
      currentWeekOnly: true,
      hasSeasonCache: true,
    }),
    'current-week',
  );
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'team-focus',
      hasSeasonCache: true,
    }),
    'current-week',
  );
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'team-mount',
      hasSeasonCache: false,
    }),
    'season',
  );
});

test('4+5. Current-week update merges by id; other weeks intact', () => {
  const existing = [
    game('week1-a'),
    game('week8-live', 'scheduled'),
    game('week12-b'),
  ];
  const weekRefresh = [
    game('week8-live', 'in_progress'),
    game('week8-new'),
  ];

  const merged = mergeWeekGamesIntoSeason(existing, weekRefresh);
  const byId = new Map(merged.map((g) => [g.id, g]));

  assert.equal(merged.length, 4);
  assert.equal(byId.get('week1-a')?.normalizedStatus, 'scheduled');
  assert.equal(byId.get('week12-b')?.normalizedStatus, 'scheduled');
  assert.equal(byId.get('week8-live')?.normalizedStatus, 'in_progress');
  assert.ok(byId.get('week8-new'));
});

test('live foreground interval is 30 seconds', () => {
  assert.equal(SCORES_LIVE_REFRESH_INTERVAL_MS, 30_000);
});

test('non-live / background / final do not run the live interval', () => {
  const liveVisible = [game('live', 'in_progress')];
  const delayedVisible = [game('delay', 'delayed')];
  const finalOnly = [game('done', 'final')];
  const postponedOnly = [game('ppd', 'postponed')];
  const pregameOnly = [game('soon', 'scheduled')];

  assert.equal(hasLiveEspnNormalizedGames(liveVisible), true);
  assert.equal(hasLiveEspnNormalizedGames(delayedVisible), true);
  assert.equal(hasLiveEspnNormalizedGames(finalOnly), false);
  assert.equal(hasLiveEspnNormalizedGames(postponedOnly), false);
  assert.equal(hasLiveEspnNormalizedGames(pregameOnly), false);

  assert.equal(
    shouldRunScoresLiveInterval({
      enabled: true,
      appIsActive: true,
      isScreenFocused: true,
      hasVisibleLiveGames: true,
    }),
    true,
  );
  assert.equal(
    shouldRunScoresLiveInterval({
      enabled: true,
      appIsActive: true,
      isScreenFocused: true,
      hasVisibleLiveGames: false,
    }),
    false,
  );
  assert.equal(
    shouldRunScoresLiveInterval({
      enabled: true,
      appIsActive: false,
      isScreenFocused: true,
      hasVisibleLiveGames: true,
    }),
    false,
  );
  assert.equal(
    shouldRunScoresLiveInterval({
      enabled: true,
      appIsActive: true,
      isScreenFocused: false,
      hasVisibleLiveGames: true,
    }),
    false,
  );
});

test('Home/Team live-poll scope remains current-week only', () => {
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'favorites-live-poll',
      currentWeekOnly: true,
      hasSeasonCache: true,
    }),
    'current-week',
  );
  assert.equal(
    resolveSeasonRefreshMode({
      trigger: 'team-live-poll',
      currentWeekOnly: true,
      hasSeasonCache: true,
    }),
    'current-week',
  );
});

console.log('\nAll Scores refresh-scope tests passed.');
