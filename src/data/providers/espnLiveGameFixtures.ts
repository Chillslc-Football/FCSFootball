/**
 * Developer/test-only ESPN scoreboard fixtures for one simulated FCS game.
 * Never used by production fetch paths.
 */

export const SIM_GAME_ID = '401999001';
export const SIM_AWAY_TEAM_ID = '149';
export const SIM_HOME_TEAM_ID = '70';
export const SIM_AWAY_NAME = 'Montana State';
export const SIM_HOME_NAME = 'Idaho';

export type SimulatedSituationOptions = {
  down: number;
  distance: number;
  yardLine: number;
  possessionTeamId: string;
  possessionText: string;
  downDistanceText: string;
  shortDownDistanceText?: string;
  isRedZone?: boolean;
};

export type SimulatedScoreboardOptions = {
  awayScore: number;
  homeScore: number;
  state: 'pre' | 'in' | 'post';
  typeName: string;
  description: string;
  shortDetail?: string;
  detail?: string;
  period?: number;
  displayClock?: string;
  /** Live scoreboard competition.situation — omitted when unavailable. */
  situation?: SimulatedSituationOptions;
};

/** Minimal ESPN scoreboard JSON matching parseEspnScoreboardNormalized expectations. */
export function buildSimulatedEspnScoreboard(
  options: SimulatedScoreboardOptions,
): Record<string, unknown> {
  const shortDetail =
    options.shortDetail ??
    (options.displayClock
      ? `${options.description} - ${options.displayClock}`
      : options.description);

  const competition: Record<string, unknown> = {
    id: `${SIM_GAME_ID}c`,
    date: '2026-10-18T19:00:00Z',
    competitors: [
      {
        homeAway: 'away',
        score: String(options.awayScore),
        team: {
          id: SIM_AWAY_TEAM_ID,
          displayName: SIM_AWAY_NAME,
          shortDisplayName: 'Montana St',
          abbreviation: 'MTST',
          location: 'Montana State',
          name: 'Bobcats',
        },
      },
      {
        homeAway: 'home',
        score: String(options.homeScore),
        team: {
          id: SIM_HOME_TEAM_ID,
          displayName: SIM_HOME_NAME,
          shortDisplayName: 'Idaho',
          abbreviation: 'IDHO',
          location: 'Idaho',
          name: 'Vandals',
        },
      },
    ],
    status: {
      period: options.period,
      displayClock: options.displayClock,
      type: {
        state: options.state,
        name: options.typeName,
        description: options.description,
        shortDetail,
        detail: options.detail ?? shortDetail,
      },
    },
  };

  if (options.situation) {
    competition.situation = {
      down: options.situation.down,
      distance: options.situation.distance,
      yardLine: options.situation.yardLine,
      isRedZone: options.situation.isRedZone ?? false,
      possession: options.situation.possessionTeamId,
      possessionText: options.situation.possessionText,
      downDistanceText: options.situation.downDistanceText,
      shortDownDistanceText:
        options.situation.shortDownDistanceText ?? options.situation.downDistanceText,
    };
  }

  return {
    events: [
      {
        id: SIM_GAME_ID,
        uid: `s:20~l:23~e:${SIM_GAME_ID}`,
        date: '2026-10-18T19:00:00Z',
        name: `${SIM_AWAY_NAME} at ${SIM_HOME_NAME}`,
        shortName: 'MTST @ IDHO',
        competitions: [competition],
        status: {
          period: options.period,
          displayClock: options.displayClock,
          type: {
            state: options.state,
            name: options.typeName,
            description: options.description,
            shortDetail,
            detail: options.detail ?? shortDetail,
          },
        },
      },
    ],
  };
}

export type LiveGameFixtureKey =
  | 'scheduled'
  | 'q1_start'
  | 'q1_score'
  | 'q2_tie'
  | 'halftime'
  | 'q3'
  | 'q4'
  | 'ot'
  | 'final_ot'
  | 'delayed'
  | 'weather_delay'
  | 'suspended'
  | 'postponed'
  | 'cancelled';

export const LIVE_GAME_FIXTURE_SEQUENCE: LiveGameFixtureKey[] = [
  'scheduled',
  'q1_start',
  'q1_score',
  'q2_tie',
  'halftime',
  'q3',
  'q4',
  'ot',
  'final_ot',
];

const FIXTURE_OPTIONS: Record<LiveGameFixtureKey, SimulatedScoreboardOptions> = {
  scheduled: {
    awayScore: 0,
    homeScore: 0,
    state: 'pre',
    typeName: 'STATUS_SCHEDULED',
    description: 'Scheduled',
    shortDetail: '10/18 - 1:00 PM MDT',
    period: 0,
    displayClock: '0:00',
  },
  q1_start: {
    awayScore: 0,
    homeScore: 0,
    state: 'in',
    typeName: 'STATUS_IN_PROGRESS',
    description: '1st Quarter',
    period: 1,
    displayClock: '15:00',
    situation: {
      down: 1,
      distance: 10,
      yardLine: 25,
      possessionTeamId: SIM_AWAY_TEAM_ID,
      possessionText: 'MTST 25',
      downDistanceText: '1st & 10',
    },
  },
  q1_score: {
    awayScore: 7,
    homeScore: 0,
    state: 'in',
    typeName: 'STATUS_IN_PROGRESS',
    description: '1st Quarter',
    period: 1,
    displayClock: '10:22',
    situation: {
      down: 1,
      distance: 10,
      yardLine: 25,
      possessionTeamId: SIM_AWAY_TEAM_ID,
      possessionText: 'MSU 25',
      downDistanceText: '1st & 10',
    },
  },
  q2_tie: {
    awayScore: 7,
    homeScore: 7,
    state: 'in',
    typeName: 'STATUS_IN_PROGRESS',
    description: '2nd Quarter',
    period: 2,
    displayClock: '6:41',
    situation: {
      down: 3,
      distance: 8,
      yardLine: 42,
      possessionTeamId: SIM_HOME_TEAM_ID,
      possessionText: 'IDAHO 42',
      downDistanceText: '3rd & 8',
    },
  },
  halftime: {
    awayScore: 14,
    homeScore: 10,
    state: 'in',
    typeName: 'STATUS_HALFTIME',
    description: 'Halftime',
    period: 2,
    displayClock: '0:00',
  },
  q3: {
    awayScore: 21,
    homeScore: 10,
    state: 'in',
    typeName: 'STATUS_IN_PROGRESS',
    description: '3rd Quarter',
    period: 3,
    displayClock: '8:15',
    situation: {
      down: 2,
      distance: 5,
      yardLine: 33,
      possessionTeamId: SIM_AWAY_TEAM_ID,
      possessionText: 'MTST 33',
      downDistanceText: '2nd & 5',
    },
  },
  q4: {
    awayScore: 21,
    homeScore: 21,
    state: 'in',
    typeName: 'STATUS_IN_PROGRESS',
    description: '4th Quarter',
    period: 4,
    displayClock: '1:34',
    situation: {
      down: 4,
      distance: 2,
      yardLine: 18,
      possessionTeamId: SIM_HOME_TEAM_ID,
      possessionText: 'IDAHO 18',
      downDistanceText: '4th & 2',
      isRedZone: true,
    },
  },
  ot: {
    awayScore: 28,
    homeScore: 28,
    state: 'in',
    typeName: 'STATUS_IN_PROGRESS',
    description: 'OT',
    period: 5,
    displayClock: '0:00',
    situation: {
      down: 1,
      distance: 0,
      yardLine: 10,
      possessionTeamId: SIM_HOME_TEAM_ID,
      possessionText: 'IDAHO 10',
      downDistanceText: '1st & Goal',
      isRedZone: true,
    },
  },
  final_ot: {
    awayScore: 35,
    homeScore: 28,
    state: 'post',
    typeName: 'STATUS_FINAL_OVERTIME',
    description: 'Final/OT',
    shortDetail: 'Final/OT',
    period: 5,
    displayClock: '0:00',
  },
  delayed: {
    awayScore: 0,
    homeScore: 0,
    state: 'pre',
    typeName: 'STATUS_DELAY',
    description: 'Delayed',
    period: 0,
    displayClock: '0:00',
  },
  weather_delay: {
    awayScore: 14,
    homeScore: 10,
    state: 'in',
    typeName: 'STATUS_RAIN_DELAY',
    description: 'Weather Delay',
    period: 2,
    displayClock: '3:00',
  },
  suspended: {
    awayScore: 21,
    homeScore: 14,
    state: 'in',
    typeName: 'STATUS_SUSPENDED',
    description: 'Suspended',
    period: 3,
    displayClock: '5:00',
  },
  postponed: {
    awayScore: 0,
    homeScore: 0,
    state: 'post',
    typeName: 'STATUS_POSTPONED',
    description: 'Postponed',
    period: 0,
    displayClock: '0:00',
  },
  cancelled: {
    awayScore: 0,
    homeScore: 0,
    state: 'post',
    typeName: 'STATUS_CANCELED',
    description: 'Cancelled',
    period: 0,
    displayClock: '0:00',
  },
};

export const ESPN_SPECIAL_STATE_FIXTURE_KEYS: LiveGameFixtureKey[] = [
  'delayed',
  'weather_delay',
  'suspended',
  'postponed',
  'cancelled',
];

/** Alias used by simulation tests. */
export const ESPN_LIVE_GAME_FIXTURE_SEQUENCE = LIVE_GAME_FIXTURE_SEQUENCE;

export type EspnLiveGameFixtureKey = LiveGameFixtureKey;

export function getLiveGameFixture(key: LiveGameFixtureKey): Record<string, unknown> {
  return buildSimulatedEspnScoreboard(FIXTURE_OPTIONS[key]);
}

/** Alias used by simulation tests. */
export function getEspnLiveGameFixture(key: LiveGameFixtureKey): Record<string, unknown> {
  return getLiveGameFixture(key);
}

/** Deep-ish clone of a fixture for mutation in empty/stale scenarios. */
export function cloneEspnLiveGameFixture(key: LiveGameFixtureKey): Record<string, unknown> {
  return JSON.parse(JSON.stringify(getLiveGameFixture(key))) as Record<string, unknown>;
}

export function getEmptyEspnScoreboard(): Record<string, unknown> {
  return { events: [] };
}
