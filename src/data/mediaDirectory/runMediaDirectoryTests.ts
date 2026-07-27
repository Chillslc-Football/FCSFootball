/**
 * Offline tests for FCS Media directory validation / filtering / coverage.
 * Run: npm run test:media-directory
 */
import assert from 'node:assert/strict';

import { normalizeMediaSourceCoverage } from '@/data/mediaDirectory/mediaCoverage';
import { resolveMediaScopeBadges } from '@/data/mediaDirectory/mediaScopeBadge';
import {
  filterMediaSources,
  filterMediaSourcesByTeam,
  isValidProviderUrl,
  validateMediaSuggestionInput,
} from '@/data/mediaDirectory/mediaSourceValidation';
import { MEDIA_SOURCE_SEEDS } from '@/data/mediaDirectory/mediaSourcesSeed';
import {
  MONTANA_ESPN_TEAM_ID,
  MONTANA_STATE_ESPN_TEAM_ID,
  type MediaSource,
} from '@/data/mediaDirectory/types';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

function baseSource(partial: Partial<MediaSource> & Pick<MediaSource, 'id' | 'name'>): MediaSource {
  return {
    subtitle: null,
    description: null,
    scope: 'national',
    conference_id: null,
    team_id: null,
    logo_url: null,
    spotify_url: null,
    youtube_url: null,
    x_url: null,
    apple_podcast_url: null,
    is_approved: true,
    display_order: 100,
    isNational: false,
    teamIds: [],
    conferenceIds: [],
    ...partial,
  };
}

test('rejects invalid provider domains', () => {
  assert.equal(isValidProviderUrl('spotify', 'https://example.com/show'), false);
  assert.equal(isValidProviderUrl('spotify', 'https://open.spotify.com/show/abc'), true);
  assert.equal(isValidProviderUrl('youtube', 'https://youtu.be/abc'), true);
  assert.equal(isValidProviderUrl('x', 'https://twitter.com/fcs'), true);
});

test('suggestion validation requires at least one coverage selection', () => {
  const missing = validateMediaSuggestionInput({
    provider: 'youtube',
    submittedUrl: 'https://www.youtube.com/@fcs',
  });
  assert.equal(missing.ok, false);

  const nationalOnly = validateMediaSuggestionInput({
    provider: 'youtube',
    submittedUrl: 'https://www.youtube.com/@fcs',
    isNational: true,
  });
  assert.equal(nationalOnly.ok, true);

  const teamsOnly = validateMediaSuggestionInput({
    provider: 'spotify',
    submittedUrl: 'https://open.spotify.com/show/abc',
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
  });
  assert.equal(teamsOnly.ok, true);
});

test('national filter uses isNational', () => {
  const sources = [
    baseSource({
      id: 'n1',
      name: 'National Show',
      isNational: true,
      scope: 'team',
      display_order: 1,
    }),
    baseSource({
      id: 't1',
      name: 'Team Show',
      isNational: false,
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      team_id: MONTANA_STATE_ESPN_TEAM_ID,
      display_order: 2,
    }),
  ];
  const filtered = filterMediaSources(sources, {
    filter: 'national',
    search: '',
    favoriteTeamIds: [MONTANA_STATE_ESPN_TEAM_ID],
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'National Show');
});

test('one source assigned to two teams matches either favorite', () => {
  const source = baseSource({
    id: 'cat-griz',
    name: 'Cat Griz Insider Podcast',
    scope: 'team',
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
    display_order: 1,
  });
  const forMontana = filterMediaSources([source], {
    filter: 'my-teams',
    search: '',
    favoriteTeamIds: [MONTANA_ESPN_TEAM_ID],
  });
  assert.equal(forMontana.length, 1);

  const forState = filterMediaSources([source], {
    filter: 'my-teams',
    search: '',
    favoriteTeamIds: [MONTANA_STATE_ESPN_TEAM_ID],
  });
  assert.equal(forState.length, 1);
});

test('one source assigned to multiple conferences keeps conference ids', () => {
  const source = baseSource({
    id: 'multi-conf',
    name: 'Multi Conf Show',
    scope: 'conference',
    isNational: false,
    conferenceIds: ['big-sky', 'mvfc', 'caa'],
    display_order: 1,
  });
  const badges = resolveMediaScopeBadges(source);
  assert.ok(badges.labels.includes('Big Sky'));
  assert.ok(badges.labels.includes('Missouri Valley Football Conference'));
  assert.ok(badges.overflowCount >= 0);
});

test('source both national and team-specific ranks as favorite-team match', () => {
  const sources = [
    baseSource({
      id: 'national-only',
      name: 'National Only',
      isNational: true,
      display_order: 1,
    }),
    baseSource({
      id: 'both',
      name: 'National Plus Team',
      isNational: true,
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      display_order: 2,
    }),
  ];
  const filtered = filterMediaSources(sources, {
    filter: 'my-teams',
    search: '',
    favoriteTeamIds: [MONTANA_STATE_ESPN_TEAM_ID],
  });
  assert.equal(filtered[0]?.name, 'National Plus Team');
  assert.equal(filtered[1]?.name, 'National Only');
});

test('Favorites match through any team association', () => {
  const filtered = filterMediaSources(MEDIA_SOURCE_SEEDS, {
    filter: 'my-teams',
    search: '',
    favoriteTeamIds: [MONTANA_ESPN_TEAM_ID],
  });
  assert.ok(filtered.some((source) => source.name === 'Cat Griz Insider Podcast'));
  assert.ok(filtered.every((source) => source.isNational || source.teamIds.includes(MONTANA_ESPN_TEAM_ID)));
});

test('legacy fallback still works', () => {
  const coverage = normalizeMediaSourceCoverage({
    id: 'legacy',
    name: 'Legacy Team',
    scope: 'team',
    team_id: MONTANA_STATE_ESPN_TEAM_ID,
    conference_id: 'big-sky',
    is_approved: true,
    display_order: 1,
  });
  assert.equal(coverage.isNational, false);
  assert.deepEqual(coverage.teamIds, [MONTANA_STATE_ESPN_TEAM_ID]);
  assert.deepEqual(coverage.conferenceIds, ['big-sky']);

  const national = normalizeMediaSourceCoverage({
    id: 'legacy-national',
    name: 'Legacy National',
    scope: 'national',
    team_id: null,
    conference_id: null,
    is_approved: true,
    display_order: 1,
  });
  assert.equal(national.isNational, true);
});

test('badge overflow displays +N more', () => {
  const source = baseSource({
    id: 'overflow',
    name: 'Busy Coverage',
    isNational: true,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
    conferenceIds: ['big-sky', 'mvfc'],
  });
  const badges = resolveMediaScopeBadges(source, { maxBadges: 3 });
  assert.equal(badges.labels.length, 3);
  assert.equal(badges.overflowCount, 2);
});

test('seed Cat Griz covers Montana State and Montana', () => {
  const catGriz = MEDIA_SOURCE_SEEDS.find((source) => source.name === 'Cat Griz Insider Podcast');
  assert.ok(catGriz);
  assert.equal(catGriz.isNational, false);
  assert.deepEqual(catGriz.teamIds, [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID]);
});

test('search matches name and subtitle', () => {
  const filtered = filterMediaSources(MEDIA_SOURCE_SEEDS, {
    filter: 'all',
    search: 'sam herder',
    favoriteTeamIds: [],
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'FCS Football Talk');
});

test('team media matches explicit teamIds only', () => {
  const sources = [
    baseSource({
      id: 'national',
      name: 'National Only',
      isNational: true,
      spotify_url: 'https://open.spotify.com/show/national',
    }),
    baseSource({
      id: 'conference',
      name: 'Conference Only',
      scope: 'conference',
      conferenceIds: ['big-sky'],
      conference_id: 'big-sky',
      youtube_url: 'https://www.youtube.com/@conf',
    }),
    baseSource({
      id: 'mtst',
      name: 'Bobcat Insider Podcast',
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      youtube_url: 'https://www.youtube.com/@bobcat',
    }),
    baseSource({
      id: 'cat-griz',
      name: 'Cat Griz Insider Podcast',
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
      spotify_url: 'https://open.spotify.com/show/catgriz',
    }),
    baseSource({
      id: 'dead',
      name: 'No Links Yet',
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    }),
  ];

  const mtst = filterMediaSourcesByTeam(sources, MONTANA_STATE_ESPN_TEAM_ID, {
    requireProviderUrl: true,
  });
  assert.equal(mtst.length, 2);
  assert.ok(mtst.every((source) => source.teamIds.includes(MONTANA_STATE_ESPN_TEAM_ID)));
  assert.ok(mtst.some((source) => source.name === 'Cat Griz Insider Podcast'));
  assert.ok(!mtst.some((source) => source.name === 'National Only'));
  assert.ok(!mtst.some((source) => source.name === 'Conference Only'));
  assert.ok(!mtst.some((source) => source.name === 'No Links Yet'));

  const montana = filterMediaSourcesByTeam(sources, MONTANA_ESPN_TEAM_ID, {
    requireProviderUrl: true,
  });
  assert.equal(montana.length, 1);
  assert.equal(montana[0]?.name, 'Cat Griz Insider Podcast');
});

test('Discover teamId filter shows only that team association', () => {
  const filtered = filterMediaSources(MEDIA_SOURCE_SEEDS, {
    filter: 'all',
    search: '',
    favoriteTeamIds: [],
    teamId: MONTANA_STATE_ESPN_TEAM_ID,
  });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((source) => source.teamIds.includes(MONTANA_STATE_ESPN_TEAM_ID)));
  assert.ok(!filtered.some((source) => source.isNational && source.teamIds.length === 0));
});

console.log('\nAll media directory tests passed.');
