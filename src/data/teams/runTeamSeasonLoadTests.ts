/**
 * Team page season load — optional Top 25 enrichment must never be fatal.
 * Run: npm.cmd run test:team-season-load
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

import assert from 'node:assert/strict';

import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import {
  loadTeamSeasonData,
  matchStaticPollTeamFromPayload,
  resolveTeamProfile,
  setFailedSeasonWeekIdsForTests,
  resetSeasonGamesLoad,
} from '@/data/teams/loadTeamSeasonGames';
import type { EspnNormalizedGame, NcaaRankingsPayload } from '@/types';

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
    awayTeamId?: string;
    homeTeamId?: string;
    awayRecord?: string;
    homeRecord?: string;
    awayRank?: number;
    homeRank?: number;
  },
): EspnNormalizedGame {
  return {
    id,
    awayTeam: 'Montana State',
    homeTeam: 'Idaho',
    awayTeamId: options?.awayTeamId ?? '147',
    homeTeamId: options?.homeTeamId ?? '70',
    startTime: '2026-09-05T18:00:00Z',
    status: 'Scheduled',
    normalizedStatus: 'scheduled',
    awayRecord: options?.awayRecord ?? '1-0',
    homeRecord: options?.homeRecord ?? '0-1',
    awayRank: options?.awayRank,
    homeRank: options?.homeRank,
    awayIsRanked: options?.awayRank != null,
    homeIsRanked: options?.homeRank != null,
  };
}

function pollPayload(rank = 3): NcaaRankingsPayload {
  return {
    pollName: 'NCAA FCS Top 25',
    updatedLabel: 'Week 1',
    seasonYear: 2026,
    week: 1,
    sourceUrl: 'https://example.test/poll',
    endpoint: 'test',
    teams: [
      {
        rank,
        team: {
          id: 'montana-state',
          name: 'Montana State',
          abbreviation: 'MTST',
        },
        record: { wins: 2, losses: 0 },
      },
    ],
  };
}

async function main(): Promise<void> {
  resetSeasonGamesLoad();
  setFailedSeasonWeekIdsForTests([]);

  await test('1: Top 25 network failure does not fail Team page data resolution', async () => {
    const data = await loadTeamSeasonData('147', {
      loadRankings: async () => {
        throw new Error('Failed to fetch NCAA FCS Top 25: Network request failed');
      },
      loadSeasonGames: async () => [game('g1')],
    });

    assert.equal(data.profile.espnTeamId, '147');
    assert.equal(data.profile.name, 'Montana State');
    assert.equal(data.profile.record, '1-0');
    assert.equal(data.profile.rank, undefined);
    assert.equal(data.games.length, 1);
  });

  await test('2: Ranking absent returns unranked team cleanly', async () => {
    assert.deepEqual(matchStaticPollTeamFromPayload('montana-state', null), {});
    assert.deepEqual(matchStaticPollTeamFromPayload('montana-state', undefined), {});
    assert.deepEqual(
      matchStaticPollTeamFromPayload('montana-state', {
        ...pollPayload(),
        teams: [],
      }),
      {},
    );

    const profile = resolveTeamProfile('147', [game('g2')], {});
    assert.equal(profile.rank, undefined);
    assert.equal(profile.record, '1-0');
  });

  await test('3: Cached ranking survives transient failure if cache exists', async () => {
    const cached = pollPayload(5);
    const data = await loadTeamSeasonData('montana-state', {
      loadRankings: async () => cached,
      loadSeasonGames: async () => [],
    });

    assert.equal(data.profile.rank, 5);
    assert.equal(data.profile.name, 'Montana State');
    assert.equal(data.profile.record, '2-0');
  });

  await test('3b: Enrichment null after failure → omit rank (cache miss path)', async () => {
    const data = await loadTeamSeasonData('147', {
      loadRankings: async () => null,
      loadSeasonGames: async () => [game('g3')],
    });
    assert.equal(data.profile.rank, undefined);
    assert.ok(data.profile.name);
  });

  await test('4: Partial schedule still returns team data', async () => {
    setFailedSeasonWeekIdsForTests(['week-4', 'week-9']);
    const data = await loadTeamSeasonData('147', {
      loadRankings: async () => null,
      loadSeasonGames: async () => [game('partial-a'), game('partial-b')],
    });

    assert.equal(data.games.length, 2);
    assert.equal(data.isPartialSchedule, true);
    assert.deepEqual(data.failedWeekIds, ['week-4', 'week-9']);
    assert.equal(data.profile.espnTeamId, '147');
    setFailedSeasonWeekIdsForTests([]);
  });

  await test('5: Optional enrichment failures do not become fatal in merge', async () => {
    const games = [game('m1')];
    const thrown = await mergeStaticRankingsOntoGames(games, {
      loadRankings: async () => {
        throw new Error('Failed to fetch NCAA FCS Top 25: Network request failed');
      },
    });
    assert.equal(thrown.rankedTeamsLoaded, 0);
    assert.equal(thrown.games.length, 1);
    assert.equal(thrown.games[0].awayRank, undefined);

    const empty = await mergeStaticRankingsOntoGames(games, {
      loadRankings: async () => null,
    });
    assert.equal(empty.rankedTeamsLoaded, 0);
    assert.equal(empty.games[0].id, 'm1');

    const ranked = await mergeStaticRankingsOntoGames(games, {
      loadRankings: async () => pollPayload(2),
    });
    assert.equal(ranked.rankedTeamsLoaded, 1);
    assert.equal(ranked.games[0].awayRank, 2);
  });

  await test('5b: ESPN record preferred over poll record when both exist', async () => {
    // Route by poll slug so rank fallback matches; ESPN record still wins.
    const data = await loadTeamSeasonData('montana-state', {
      loadRankings: async () => pollPayload(1),
      loadSeasonGames: async () => [game('rec', { awayRecord: '4-1' })],
    });
    assert.equal(data.profile.record, '4-1');
    assert.equal(data.profile.rank, 1);
    assert.notEqual(data.profile.record, '2-0');
  });

  console.log('\nAll team season load tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
