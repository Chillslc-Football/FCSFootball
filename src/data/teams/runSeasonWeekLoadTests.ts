/**
 * Season week retry / partial schedule / team record source tests.
 * Run: npm.cmd run test:season-week-load
 */

import assert from 'node:assert/strict';

import {
  resolveTeamProfile,
  setFailedSeasonWeekIdsForTests,
  resetSeasonGamesLoad,
} from '@/data/teams/loadTeamSeasonGames';
import { resolveSeasonRefreshMode } from '@/data/teams/seasonGamesRefresh';
import {
  collectGamesFromWeekResults,
  fetchSeasonWeekWithRetry,
  pickTeamProfileSourceGame,
  shouldRetryFailedSeasonWeeks,
  type SeasonWeekFetchResult,
} from '@/data/teams/seasonWeekLoad';
import type { EspnNormalizedGame, ScheduleWeekId } from '@/types';

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

function game(
  id: string,
  options?: {
    startTime?: string;
    awayRecord?: string;
    homeRecord?: string;
    awayTeamId?: string;
    homeTeamId?: string;
    status?: EspnNormalizedGame['normalizedStatus'];
  },
): EspnNormalizedGame {
  return {
    id,
    awayTeam: 'Montana State',
    homeTeam: 'Idaho',
    awayTeamId: options?.awayTeamId ?? '149',
    homeTeamId: options?.homeTeamId ?? '70',
    startTime: options?.startTime ?? '2026-09-05T18:00:00Z',
    status: 'Scheduled',
    normalizedStatus: options?.status ?? 'scheduled',
    awayRecord: options?.awayRecord,
    homeRecord: options?.homeRecord,
  };
}

async function main(): Promise<void> {
  await test('A: week fails once then retry succeeds', async () => {
    let attempts = 0;
    const result = await fetchSeasonWeekWithRetry({
      weekId: 'week-3',
      delayMs: 1,
      sleep: async () => undefined,
      fetchWeek: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('network blip');
        return [game('w3-a')];
      },
    });
    assert.equal(result.failed, false);
    assert.equal(result.attempts, 2);
    assert.equal(result.games?.length, 1);
  });

  await test('B: week fails twice → partial flag; successful weeks remain', async () => {
    const week2 = await fetchSeasonWeekWithRetry({
      weekId: 'week-2',
      delayMs: 1,
      sleep: async () => undefined,
      fetchWeek: async () => [game('w2-a')],
    });
    const week3 = await fetchSeasonWeekWithRetry({
      weekId: 'week-3',
      delayMs: 1,
      sleep: async () => undefined,
      fetchWeek: async () => {
        throw new Error('still down');
      },
    });

    const collected = collectGamesFromWeekResults(
      [week2, week3] as SeasonWeekFetchResult[],
      [game('existing')],
    );
    assert.equal(collected.isPartial, true);
    assert.deepEqual(collected.failedWeekIds, ['week-3']);
    assert.ok(collected.games.some((g) => g.id === 'existing'));
    assert.ok(collected.games.some((g) => g.id === 'w2-a'));
    assert.equal(
      collected.games.some((g) => g.id === 'w3-a'),
      false,
    );
    assert.equal(week3.attempts, 2);
  });

  await test('C: later recovery clears partial state tracking', () => {
    resetSeasonGamesLoad();
    setFailedSeasonWeekIdsForTests(['week-4']);
    const recovered: SeasonWeekFetchResult[] = [
      {
        weekId: 'week-4',
        games: [game('w4-a')],
        attempts: 1,
        failed: false,
      },
    ];
    const collected = collectGamesFromWeekResults(recovered, []);
    assert.equal(collected.isPartial, false);
    assert.deepEqual(collected.failedWeekIds, []);
    assert.ok(collected.games.some((g) => g.id === 'w4-a'));
    // Simulate store clearing failed weeks after recovery
    setFailedSeasonWeekIdsForTests(collected.failedWeekIds);
    assert.equal(collected.failedWeekIds.length, 0);
  });

  await test('D: team profile record comes from latest ESPN game with record', () => {
    const games = [
      game('early', {
        startTime: '2026-09-06T18:00:00Z',
        awayRecord: '0-0',
        awayTeamId: '149',
      }),
      game('mid', {
        startTime: '2026-10-11T18:00:00Z',
        awayRecord: '6-1',
        awayTeamId: '149',
        status: 'final',
      }),
      game('latest-final', {
        startTime: '2026-10-18T18:00:00Z',
        awayRecord: '7-1',
        awayTeamId: '149',
        status: 'final',
      }),
    ];

    const source = pickTeamProfileSourceGame(games, '149');
    assert.equal(source?.id, 'latest-final');
    const profile = resolveTeamProfile('149', games, { record: '0-0' });
    assert.equal(profile.record, '7-1');
  });

  await test('E: conference standings refresh mode — focus/tab not live-poll', () => {
    // Standings are force-refreshed on focus / standings tab; live ticks stay schedule-only.
    assert.equal(shouldRetryFailedSeasonWeeks('team-focus'), true);
    assert.equal(shouldRetryFailedSeasonWeeks('team-app-active'), true);
    assert.equal(shouldRetryFailedSeasonWeeks('conference-standings-focus'), true);
  });

  await test('F: failed-week retry and record refresh skip 30s live ticks', () => {
    assert.equal(shouldRetryFailedSeasonWeeks('team-live-poll'), false);
    assert.equal(shouldRetryFailedSeasonWeeks('favorites-live-poll'), false);
    assert.equal(
      resolveSeasonRefreshMode({
        trigger: 'team-live-poll',
        currentWeekOnly: true,
        hasSeasonCache: true,
      }),
      'current-week',
    );
  });

  console.log('\nAll season week load tests passed.');
}

void main();
