/**
 * Offline tests for FCS Media directory validation / filtering / coverage.
 * Run: npm run test:media-directory
 */
import assert from 'node:assert/strict';

import { normalizeMediaSourceCoverage } from '@/data/mediaDirectory/mediaCoverage';
import { resolveMediaScopeBadges } from '@/data/mediaDirectory/mediaScopeBadge';
import {
  compareMediaSourcesByName,
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
});

test('directory lists all approved sources alphabetically', () => {
  const filtered = filterMediaSources(MEDIA_SOURCE_SEEDS, { search: '' });
  assert.ok(filtered.length === MEDIA_SOURCE_SEEDS.filter((s) => s.is_approved).length);
  for (let i = 1; i < filtered.length; i += 1) {
    assert.ok(compareMediaSourcesByName(filtered[i - 1]!, filtered[i]!) <= 0);
  }
});

test('search matches name, subtitle, and team labels', () => {
  const bySubtitle = filterMediaSources(MEDIA_SOURCE_SEEDS, {
    search: 'sam herder',
  });
  assert.equal(bySubtitle.length, 1);
  assert.equal(bySubtitle[0]?.name, 'FCS Football Talk');

  const byTeam = filterMediaSources(MEDIA_SOURCE_SEEDS, {
    search: 'montana state',
  });
  assert.ok(byTeam.some((source) => source.name === 'Skyline Sports'));
});

test('team media matches explicit teamIds only', () => {
  const sources = [
    baseSource({
      id: 'national',
      name: 'National Only',
      isNational: true,
    }),
    baseSource({
      id: 'conference',
      name: 'Conference Only',
      scope: 'conference',
      conferenceIds: ['big-sky'],
      conference_id: 'big-sky',
    }),
    baseSource({
      id: 'mtst',
      name: 'Zebra Show',
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    }),
    baseSource({
      id: 'cat-griz',
      name: 'Cat Griz Insider Podcast',
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
    }),
    baseSource({
      id: 'alpha',
      name: 'Alpha Bobcats',
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    }),
  ];

  const mtst = filterMediaSourcesByTeam(sources, MONTANA_STATE_ESPN_TEAM_ID);
  assert.equal(mtst.length, 3);
  assert.equal(mtst[0]?.name, 'Alpha Bobcats');
  assert.ok(mtst.every((source) => source.teamIds.includes(MONTANA_STATE_ESPN_TEAM_ID)));
  assert.ok(!mtst.some((source) => source.name === 'National Only'));
  assert.ok(!mtst.some((source) => source.name === 'Conference Only'));

  const montana = filterMediaSourcesByTeam(sources, MONTANA_ESPN_TEAM_ID);
  assert.equal(montana.length, 1);
  assert.equal(montana[0]?.name, 'Cat Griz Insider Podcast');
});

test('team media inline limit is 4', () => {
  const sources = Array.from({ length: 6 }, (_, index) =>
    baseSource({
      id: `t${index}`,
      name: `Show ${index}`,
      scope: 'team',
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      display_order: index,
    }),
  );
  const limited = filterMediaSourcesByTeam(sources, MONTANA_STATE_ESPN_TEAM_ID, {
    limit: 4,
  });
  assert.equal(limited.length, 4);
});

test('Discover teamId filter shows only that team association', () => {
  const filtered = filterMediaSources(MEDIA_SOURCE_SEEDS, {
    teamId: MONTANA_STATE_ESPN_TEAM_ID,
  });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((source) => source.teamIds.includes(MONTANA_STATE_ESPN_TEAM_ID)));
  assert.ok(!filtered.some((source) => source.isNational && source.teamIds.length === 0));
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

console.log('\nAll media directory tests passed.');
