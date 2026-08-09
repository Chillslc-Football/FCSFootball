/**
 * ESPN team roster parser / link / grouping tests.
 * Run: npm.cmd run test:espn-roster
 */

import assert from 'node:assert/strict';

import {
  parseEspnRosterAthlete,
  parseEspnTeamRoster,
  resolveEspnPlayerCardUrl,
} from '@/data/providers/espnRosterParser';
import {
  ESPN_ROSTER_CACHE_TTL_MS,
  buildEspnRosterCacheKey,
  buildEspnRosterUrl,
} from '@/data/providers/espnRosterProvider';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

function athlete(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '5084941',
    displayName: 'Weston Adams',
    jersey: '12',
    displayHeight: `5' 11"`,
    displayWeight: '200 lbs',
    headshot: { href: 'https://a.espncdn.com/i/headshots/college-football/players/full/5084941.png' },
    birthPlace: { city: 'Shell', state: 'WY', displayText: 'Shell, WY' },
    experience: { years: 3, displayValue: 'Junior', abbreviation: 'JR' },
    position: {
      abbreviation: 'WR',
      displayName: 'Wide Receiver',
      name: 'Wide Receiver',
    },
    status: { type: 'active', name: 'Active' },
    links: [
      {
        rel: ['playercard', 'desktop', 'athlete'],
        href: 'https://www.espn.com/college-football/player/_/id/5084941/weston-adams',
      },
      {
        rel: ['stats', 'sportscenter', 'app'],
        href: 'sportscenter://x-callback-url/showClubhouse?uid=s:20~l:23~a:5084941',
      },
    ],
    ...overrides,
  };
}

test('roster URL and cache key', () => {
  assert.equal(
    buildEspnRosterUrl('147'),
    'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/147/roster',
  );
  assert.equal(buildEspnRosterCacheKey('147'), 'espn:roster:147');
  assert.equal(ESPN_ROSTER_CACHE_TTL_MS, 6 * 60 * 60 * 1000);
});

test('parses full athlete with optional fields', () => {
  const player = parseEspnRosterAthlete(athlete());
  assert.ok(player);
  assert.equal(player?.displayName, 'Weston Adams');
  assert.equal(player?.jersey, '12');
  assert.equal(player?.positionAbbreviation, 'WR');
  assert.equal(player?.classYear, 'Junior');
  assert.equal(player?.height, `5' 11"`);
  assert.equal(player?.weight, '200 lbs');
  assert.equal(player?.hometown, 'Shell, WY');
  assert.ok(player?.headshotUrl?.includes('5084941.png'));
  assert.equal(
    player?.espnPlayerUrl,
    'https://www.espn.com/college-football/player/_/id/5084941/weston-adams',
  );
});

test('missing optional fields omit values', () => {
  const player = parseEspnRosterAthlete(
    athlete({
      jersey: undefined,
      displayHeight: undefined,
      displayWeight: undefined,
      birthPlace: undefined,
      headshot: undefined,
      experience: undefined,
      links: [],
    }),
  );
  assert.ok(player);
  assert.equal(player?.jersey, undefined);
  assert.equal(player?.height, undefined);
  assert.equal(player?.weight, undefined);
  assert.equal(player?.hometown, undefined);
  assert.equal(player?.headshotUrl, undefined);
  assert.equal(player?.classYear, undefined);
  assert.equal(player?.espnPlayerUrl, undefined);
});

test('playercard desktop https link preferred over app scheme', () => {
  const url = resolveEspnPlayerCardUrl(athlete().links);
  assert.equal(url, 'https://www.espn.com/college-football/player/_/id/5084941/weston-adams');
  assert.equal(resolveEspnPlayerCardUrl([{ rel: ['app'], href: 'sportscenter://x' }]), undefined);
  assert.equal(
    resolveEspnPlayerCardUrl([
      { rel: ['desktop'], href: 'https://www.espn.com/college-football/player/_/id/1/a' },
    ]),
    'https://www.espn.com/college-football/player/_/id/1/a',
  );
});

test('malformed athlete entries are skipped', () => {
  assert.equal(parseEspnRosterAthlete(null), null);
  assert.equal(parseEspnRosterAthlete({ displayName: 'No Id' }), null);
  assert.equal(parseEspnRosterAthlete({ id: '1' }), null);
});

test('empty roster and empty categories', () => {
  const empty = parseEspnTeamRoster({ athletes: [], team: { id: '147' } }, '147');
  assert.equal(empty.players.length, 0);
  assert.equal(empty.groups.length, 0);

  const emptyGroups = parseEspnTeamRoster(
    {
      team: { id: '147', displayName: 'Montana State Bobcats' },
      athletes: [
        { position: 'offense', items: [] },
        { position: 'injuredReserveOrOut', items: [] },
      ],
    },
    '147',
  );
  assert.equal(emptyGroups.groups.length, 0);
});

test('groups by ESPN category then position; jersey order within position', () => {
  const roster = parseEspnTeamRoster(
    {
      team: { id: '147', displayName: 'Montana State Bobcats' },
      season: { year: 2026 },
      athletes: [
        {
          position: 'offense',
          items: [
            athlete({ id: '2', displayName: 'B Runner', jersey: '22', position: { abbreviation: 'RB', displayName: 'Running Back' } }),
            athlete({ id: '1', displayName: 'A Quarter', jersey: '8', position: { abbreviation: 'QB', displayName: 'Quarterback' } }),
            athlete({ id: '3', displayName: 'C Quarter', jersey: '2', position: { abbreviation: 'QB', displayName: 'Quarterback' } }),
          ],
        },
        {
          position: 'defense',
          items: [
            athlete({ id: '4', displayName: 'D Back', jersey: '1', position: { abbreviation: 'CB', displayName: 'Cornerback' } }),
          ],
        },
        {
          position: 'practiceSquad',
          items: [
            athlete({ id: '9', displayName: 'Hidden', jersey: '99', position: { abbreviation: 'WR', displayName: 'Wide Receiver' } }),
          ],
        },
      ],
    },
    '147',
  );

  assert.equal(roster.seasonYear, 2026);
  assert.equal(roster.groups.length, 2);
  assert.equal(roster.groups[0].title, 'Offense');
  assert.equal(roster.groups[0].positionGroups[0].key, 'QB');
  assert.deepEqual(
    roster.groups[0].positionGroups[0].players.map((p) => p.jersey),
    ['2', '8'],
  );
  assert.equal(roster.groups[0].positionGroups[1].key, 'RB');
  assert.equal(roster.groups[1].title, 'Defense');
  assert.equal(roster.players.length, 4);
});

test('inactive players excluded', () => {
  const roster = parseEspnTeamRoster({
    athletes: [
      {
        position: 'offense',
        items: [
          athlete({ id: '1', status: { type: 'active' } }),
          athlete({ id: '2', displayName: 'Out Player', status: { type: 'inactive' } }),
        ],
      },
    ],
  });
  assert.equal(roster.players.length, 1);
  assert.equal(roster.players[0].id, '1');
});

console.log('\nAll ESPN roster tests passed.');
