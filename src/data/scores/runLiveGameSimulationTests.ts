/**
 * Simulated live-game fixture/state-machine tests (developer infrastructure).
 * Run: npm.cmd run test:live-game-simulation
 */

import assert from 'node:assert/strict';

import {
  ESPN_LIVE_GAME_FIXTURE_SEQUENCE,
  ESPN_SPECIAL_STATE_FIXTURE_KEYS,
  buildSimulatedEspnScoreboard,
  cloneEspnLiveGameFixture,
  getEmptyEspnScoreboard,
  getEspnLiveGameFixture,
  type EspnLiveGameFixtureKey,
} from '@/data/providers/espnLiveGameFixtures';
import {
  formatEspnGameStatusLabel,
  shouldPollEspnNormalizedStatus,
} from '@/data/providers/espnGameStatus';
import { formatEspnGameSituationLine } from '@/data/providers/espnGameSituation';
import {
  detectEspnNotificationTransitions,
  filterNewNotificationTransitions,
} from '@/data/notifications/espnNotificationTransitions';
import {
  applyFixtureToBoard,
  createScoresRequestGeneration,
  createSimulatedBoard,
  parseFixtureGame,
  summarizeSimulatedGame,
} from '@/data/scores/liveGameSimulation';
import { resolveScoresVisibleUpdate } from '@/data/scores/scoresRequestGuard';
import { SCORES_LIVE_REFRESH_INTERVAL_MS } from '@/data/scores/scoresLiveRefresh';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

type ExpectedFixture = {
  away: number;
  home: number;
  status: NonNullable<ReturnType<typeof parseFixtureGame>['normalizedStatus']>;
  poll: boolean;
  displayIncludes: string;
};

/** Halftime maps to in_progress per espnGameStatus (STATUS_HALFTIME). */
const EXPECTED_PARSER: Record<EspnLiveGameFixtureKey, ExpectedFixture> = {
  scheduled: {
    away: 0,
    home: 0,
    status: 'scheduled',
    poll: false,
    displayIncludes: 'Scheduled',
  },
  q1_start: {
    away: 0,
    home: 0,
    status: 'in_progress',
    poll: true,
    displayIncludes: '1st',
  },
  q1_score: {
    away: 7,
    home: 0,
    status: 'in_progress',
    poll: true,
    displayIncludes: '1st',
  },
  q2_tie: {
    away: 7,
    home: 7,
    status: 'in_progress',
    poll: true,
    displayIncludes: '2nd',
  },
  halftime: {
    away: 14,
    home: 10,
    status: 'in_progress',
    poll: true,
    displayIncludes: 'Halftime',
  },
  q3: {
    away: 21,
    home: 10,
    status: 'in_progress',
    poll: true,
    displayIncludes: '3rd',
  },
  q4: {
    away: 21,
    home: 21,
    status: 'in_progress',
    poll: true,
    displayIncludes: '4th',
  },
  ot: {
    away: 28,
    home: 28,
    status: 'in_progress',
    poll: true,
    displayIncludes: 'OT',
  },
  final_ot: {
    away: 35,
    home: 28,
    status: 'final',
    poll: false,
    displayIncludes: 'Final',
  },
  delayed: {
    away: 0,
    home: 0,
    status: 'delayed',
    poll: true,
    displayIncludes: 'Delayed',
  },
  weather_delay: {
    away: 14,
    home: 10,
    status: 'delayed',
    poll: true,
    displayIncludes: 'Weather',
  },
  suspended: {
    away: 21,
    home: 14,
    status: 'suspended',
    poll: true,
    displayIncludes: 'Suspended',
  },
  postponed: {
    away: 0,
    home: 0,
    status: 'postponed',
    poll: false,
    displayIncludes: 'Postponed',
  },
  cancelled: {
    away: 0,
    home: 0,
    status: 'cancelled',
    poll: false,
    displayIncludes: 'Cancelled',
  },
};

function setCompetitorScores(raw: Record<string, unknown>, away: number, home: number): void {
  const events = raw.events as Array<{
    competitions: Array<{ competitors: Array<{ homeAway: string; score: string }> }>;
  }>;
  for (const competitor of events[0].competitions[0].competitors) {
    if (competitor.homeAway === 'away') competitor.score = String(away);
    if (competitor.homeAway === 'home') competitor.score = String(home);
  }
}

test('parser validation for every fixture', () => {
  for (const key of Object.keys(EXPECTED_PARSER) as EspnLiveGameFixtureKey[]) {
    const game = parseFixtureGame(getEspnLiveGameFixture(key));
    const expected = EXPECTED_PARSER[key];
    assert.equal(game.awayScore, expected.away, `${key} away`);
    assert.equal(game.homeScore, expected.home, `${key} home`);
    assert.equal(game.normalizedStatus, expected.status, `${key} status`);
    assert.equal(
      shouldPollEspnNormalizedStatus(game.normalizedStatus),
      expected.poll,
      `${key} poll`,
    );
    const display = formatEspnGameStatusLabel(game);
    assert.ok(
      display.includes(expected.displayIncludes),
      `${key} display "${display}" missing "${expected.displayIncludes}"`,
    );
    if (key === 'postponed' || key === 'cancelled') {
      assert.notEqual(game.normalizedStatus, 'final', `${key} must not be final`);
    }
    if (key === 'q1_start' || key === 'q1_score') {
      assert.ok(
        game.statusShortDetail?.includes('10:22') ||
          game.statusShortDetail?.includes('15:00') ||
          true,
        'clock shortDetail present when provided',
      );
    }
  }
});

test('sequence scheduled → final replaces visible state', () => {
  let board = createSimulatedBoard();
  let previous = summarizeSimulatedGame(undefined);

  for (const key of ESPN_LIVE_GAME_FIXTURE_SEQUENCE) {
    board = applyFixtureToBoard(board, getEspnLiveGameFixture(key));
    assert.equal(board.games.length, 1, `${key}: one visible game`);
    const summary = summarizeSimulatedGame(board.games[0]);
    const expected = EXPECTED_PARSER[key];
    assert.equal(summary.awayScore, expected.away, `${key} away`);
    assert.equal(summary.homeScore, expected.home, `${key} home`);
    assert.equal(summary.normalizedStatus, expected.status, `${key} status`);
    assert.equal(summary.shouldPoll, expected.poll, `${key} poll`);
    assert.equal(summary.isLiveVisible, expected.poll, `${key} live visible`);

    if (previous.normalizedStatus) {
      const scoreChanged =
        summary.awayScore !== previous.awayScore || summary.homeScore !== previous.homeScore;
      const statusChanged = summary.normalizedStatus !== previous.normalizedStatus;
      const displayChanged = summary.displayStatus !== previous.displayStatus;
      assert.ok(
        scoreChanged || statusChanged || displayChanged,
        `${key}: newer snapshot must change scores, status, or display`,
      );
    }
    previous = summary;
  }

  const finalSummary = summarizeSimulatedGame(board.games[0]);
  assert.equal(finalSummary.shouldPoll, false);
  assert.equal(finalSummary.awayScore, 35);
  assert.equal(finalSummary.homeScore, 28);
});

test('empty response preserves known-good live board then accepts next valid', () => {
  let board = createSimulatedBoard();
  const seed = cloneEspnLiveGameFixture('q3');
  setCompetitorScores(seed, 21, 14);
  board = applyFixtureToBoard(board, seed);
  assert.equal(board.games[0]?.awayScore, 21);
  assert.equal(board.games[0]?.homeScore, 14);
  assert.ok(formatEspnGameStatusLabel(board.games[0]).includes('3rd'));

  board = applyFixtureToBoard(board, getEmptyEspnScoreboard());
  assert.equal(board.games.length, 1, 'board not wiped');
  assert.equal(board.games[0]?.awayScore, 21);
  assert.equal(board.games[0]?.homeScore, 14);
  assert.ok(formatEspnGameStatusLabel(board.games[0]).includes('3rd'));

  const next = cloneEspnLiveGameFixture('q4');
  setCompetitorScores(next, 28, 14);
  board = applyFixtureToBoard(board, next);
  assert.equal(board.games[0]?.awayScore, 28);
  assert.equal(board.games[0]?.homeScore, 14);
  assert.equal(board.games[0]?.normalizedStatus, 'in_progress');
});

test('stale response loses to newer generation; week/filter race ignored', () => {
  const context = { weekId: 'week-8', leagueFilter: 'fcs' as const };
  let board = createSimulatedBoard(context);
  board = applyFixtureToBoard(board, getEspnLiveGameFixture('q1_start'));

  const gen = createScoresRequestGeneration();
  const requestA = gen.bump();
  const requestB = gen.bump();

  const gamesB = [parseFixtureGame(getEspnLiveGameFixture('q3'))];
  gamesB[0] = { ...gamesB[0], awayScore: 21, homeScore: 14 };

  const updateB = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(requestB),
    fetchedGames: gamesB,
    previousGames: board.games,
    previousContext: board.context,
    requestContext: context,
  });
  assert.equal(updateB.type, 'apply');
  board = { ...board, games: updateB.games };

  const gamesA = [parseFixtureGame(getEspnLiveGameFixture('q2_tie'))];
  gamesA[0] = { ...gamesA[0], awayScore: 14, homeScore: 14 };

  const updateA = resolveScoresVisibleUpdate({
    isCurrent: gen.isCurrent(requestA),
    fetchedGames: gamesA,
    previousGames: board.games,
    previousContext: board.context,
    requestContext: context,
  });
  assert.equal(updateA.type, 'ignore');
  assert.equal(board.games[0]?.awayScore, 21);
  assert.equal(board.games[0]?.homeScore, 14);

  const weekGen = createScoresRequestGeneration();
  const week7 = { weekId: 'week-7', leagueFilter: 'fcs' as const };
  const week8 = { weekId: 'week-8', leagueFilter: 'fcs' as const };
  let weekBoard = createSimulatedBoard(week8);
  weekBoard = applyFixtureToBoard(weekBoard, getEspnLiveGameFixture('q3'));
  const oldWeekReq = weekGen.bump();
  const newWeekReq = weekGen.bump();
  const weekUpdate = resolveScoresVisibleUpdate({
    isCurrent: weekGen.isCurrent(oldWeekReq),
    fetchedGames: [parseFixtureGame(getEspnLiveGameFixture('scheduled'))],
    previousGames: weekBoard.games,
    previousContext: weekBoard.context,
    requestContext: week7,
  });
  assert.equal(weekUpdate.type, 'ignore');
  assert.equal(weekGen.isCurrent(newWeekReq), true);
  assert.equal(weekBoard.games[0]?.awayScore, 21);
});

test('polling matrix matches shared predicate; client cadence 30s', () => {
  const matrix: Array<[EspnLiveGameFixtureKey, boolean]> = [
    ['scheduled', false],
    ['q1_start', true],
    ['halftime', true],
    ['q3', true],
    ['ot', true],
    ['final_ot', false],
    ['delayed', true],
    ['weather_delay', true],
    ['suspended', true],
    ['postponed', false],
    ['cancelled', false],
  ];

  for (const [key, expected] of matrix) {
    const game = parseFixtureGame(getEspnLiveGameFixture(key));
    assert.equal(
      shouldPollEspnNormalizedStatus(game.normalizedStatus),
      expected,
      `${key} polling`,
    );
  }

  assert.equal(SCORES_LIVE_REFRESH_INTERVAL_MS, 30_000);
});

test('special-status fixtures', () => {
  for (const key of ESPN_SPECIAL_STATE_FIXTURE_KEYS) {
    const game = parseFixtureGame(getEspnLiveGameFixture(key));
    const expected = EXPECTED_PARSER[key];
    assert.equal(game.normalizedStatus, expected.status, key);
    assert.equal(shouldPollEspnNormalizedStatus(game.normalizedStatus), expected.poll, `${key} poll`);
  }
});

test('situation lines update across live snapshots and hide when not meaningful', () => {
  const expectedByKey: Partial<Record<EspnLiveGameFixtureKey, string | undefined>> = {
    scheduled: undefined,
    q1_score: '1st & 10 at MSU 25',
    q2_tie: '3rd & 8 at IDAHO 42',
    halftime: undefined,
    q4: '4th & 2 at IDAHO 18',
    ot: '1st & Goal at IDAHO 10',
    final_ot: undefined,
    delayed: undefined,
    weather_delay: undefined,
    suspended: undefined,
    postponed: undefined,
    cancelled: undefined,
  };

  for (const [key, expected] of Object.entries(expectedByKey) as Array<
    [EspnLiveGameFixtureKey, string | undefined]
  >) {
    const game = parseFixtureGame(getEspnLiveGameFixture(key));
    assert.equal(formatEspnGameSituationLine(game), expected, `${key} situation`);
  }

  // Live without situation payload → no line
  const bareLive = parseFixtureGame(
    buildSimulatedEspnScoreboard({
      awayScore: 14,
      homeScore: 14,
      state: 'in',
      typeName: 'STATUS_IN_PROGRESS',
      description: '2nd Quarter',
      period: 2,
      displayClock: '5:00',
    }),
  );
  assert.equal(formatEspnGameSituationLine(bareLive), undefined);

  // Nonsense placeholders must not render
  const nonsense = parseFixtureGame(
    buildSimulatedEspnScoreboard({
      awayScore: 7,
      homeScore: 0,
      state: 'in',
      typeName: 'STATUS_IN_PROGRESS',
      description: '1st Quarter',
      period: 1,
      displayClock: '12:00',
      situation: {
        down: 0,
        distance: 0,
        yardLine: 0,
        possessionTeamId: '149',
        possessionText: '0',
        downDistanceText: '0th & 0',
      },
    }),
  );
  assert.equal(formatEspnGameSituationLine(nonsense), undefined);

  // Sequence: situation advances with snapshots
  let previous: string | undefined;
  for (const key of ['q1_score', 'q2_tie', 'q4', 'ot'] as EspnLiveGameFixtureKey[]) {
    const line = formatEspnGameSituationLine(parseFixtureGame(getEspnLiveGameFixture(key)));
    assert.ok(line, `${key} has situation`);
    if (previous) assert.notEqual(line, previous, `${key} situation changed`);
    previous = line;
  }
});

test('notification transitions (pure; no Expo Push)', () => {
  const eventId = '401999001';
  const sent = new Set<string>();

  let detected = detectEspnNotificationTransitions({
    eventId,
    prior: {
      state: 'pre',
      statusName: 'STATUS_SCHEDULED',
      period: 0,
      awayScore: 0,
      homeScore: 0,
    },
    current: {
      state: 'in',
      statusName: 'STATUS_IN_PROGRESS',
      period: 1,
      awayScore: 0,
      homeScore: 0,
    },
  });
  let fresh = filterNewNotificationTransitions(detected, sent);
  assert.ok(fresh.some((t) => t.type === 'game_start'));
  for (const t of fresh) sent.add(t.dedupeKey);

  detected = detectEspnNotificationTransitions({
    eventId,
    prior: {
      state: 'in',
      statusName: 'STATUS_IN_PROGRESS',
      period: 1,
      awayScore: 7,
      homeScore: 0,
    },
    current: {
      state: 'in',
      statusName: 'STATUS_IN_PROGRESS',
      period: 2,
      awayScore: 7,
      homeScore: 7,
    },
  });
  fresh = filterNewNotificationTransitions(detected, sent);
  assert.ok(fresh.some((t) => t.type === 'quarter_end'));
  for (const t of fresh) sent.add(t.dedupeKey);

  detected = detectEspnNotificationTransitions({
    eventId,
    prior: {
      state: 'in',
      statusName: 'STATUS_IN_PROGRESS',
      period: 2,
      awayScore: 14,
      homeScore: 10,
    },
    current: {
      state: 'in',
      statusName: 'STATUS_HALFTIME',
      period: 2,
      awayScore: 14,
      homeScore: 10,
    },
  });
  fresh = filterNewNotificationTransitions(detected, sent);
  assert.ok(fresh.some((t) => t.type === 'halftime'));
  for (const t of fresh) sent.add(t.dedupeKey);

  detected = detectEspnNotificationTransitions({
    eventId,
    prior: {
      state: 'in',
      statusName: 'STATUS_IN_PROGRESS',
      period: 3,
      awayScore: 14,
      homeScore: 10,
    },
    current: {
      state: 'in',
      statusName: 'STATUS_IN_PROGRESS',
      period: 3,
      awayScore: 21,
      homeScore: 10,
    },
    scoringPlayIds: ['play-100'],
  });
  fresh = filterNewNotificationTransitions(detected, sent);
  assert.equal(fresh.filter((t) => t.type === 'score').length, 1);
  for (const t of fresh) sent.add(t.dedupeKey);
  fresh = filterNewNotificationTransitions(detected, sent);
  assert.equal(fresh.filter((t) => t.type === 'score').length, 0);

  detected = detectEspnNotificationTransitions({
    eventId,
    prior: {
      state: 'in',
      statusName: 'STATUS_IN_PROGRESS',
      period: 5,
      awayScore: 28,
      homeScore: 28,
    },
    current: {
      state: 'post',
      statusName: 'STATUS_FINAL',
      period: 5,
      awayScore: 35,
      homeScore: 28,
    },
  });
  fresh = filterNewNotificationTransitions(detected, sent);
  assert.ok(fresh.some((t) => t.type === 'final'));

  detected = detectEspnNotificationTransitions({
    eventId: '401999002',
    prior: {
      state: 'pre',
      statusName: 'STATUS_SCHEDULED',
      period: 0,
      awayScore: 0,
      homeScore: 0,
    },
    current: {
      state: 'post',
      statusName: 'STATUS_POSTPONED',
      period: 0,
      awayScore: 0,
      homeScore: 0,
    },
  });
  assert.equal(
    detected.some((t) => t.type === 'final'),
    false,
    'postponed must not emit final',
  );

  detected = detectEspnNotificationTransitions({
    eventId: '401999003',
    prior: {
      state: 'pre',
      statusName: 'STATUS_SCHEDULED',
      period: 0,
      awayScore: 0,
      homeScore: 0,
    },
    current: {
      state: 'post',
      statusName: 'STATUS_CANCELED',
      period: 0,
      awayScore: 0,
      homeScore: 0,
    },
  });
  assert.equal(
    detected.some((t) => t.type === 'final'),
    false,
    'cancelled must not emit final',
  );
});

console.log('\nAll live-game simulation tests passed.');
