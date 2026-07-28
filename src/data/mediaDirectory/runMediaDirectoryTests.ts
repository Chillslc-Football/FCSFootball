/**
 * Offline tests for FCS Media directory validation / filtering / coverage.
 * Run: npm run test:media-directory
 */
import assert from 'node:assert/strict';

import {
  buildMediaBrowseTeamOptions,
  createEmptyMediaBrowseFilter,
  filterMediaBrowseTeams,
  filterMediaSourcesByBrowse,
  formatMediaBrowseCoverageLabel,
  getMediaBrowseBadgeLetter,
  getMediaBrowseChips,
  getMediaBrowseConferenceOptions,
  mediaBrowseFilterToCoverage,
  removeMediaBrowseChip,
  toggleMediaBrowseConference,
  toggleMediaBrowseNational,
  toggleMediaBrowseTeam,
} from '@/data/mediaDirectory/mediaBrowse';
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
import { resolveMediaArtworkUrl } from '@/data/mediaDirectory/resolveMediaArtworkUrl';
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

test('artwork resolver uses stored logo_url only (no runtime provider fetch)', () => {
  assert.equal(resolveMediaArtworkUrl({ logo_url: null }), null);
  assert.equal(resolveMediaArtworkUrl({ logo_url: '  ' }), null);
  assert.equal(resolveMediaArtworkUrl({ logo_url: 'not-a-url' }), null);
  assert.equal(
    resolveMediaArtworkUrl({
      logo_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fexample',
    }),
    'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fexample',
  );

  const withSpotifyButNoLogo = baseSource({
    id: 't-no-logo',
    name: 'No Logo',
    spotify_url: 'https://open.spotify.com/show/abc',
    logo_url: null,
  });
  assert.equal(resolveMediaArtworkUrl(withSpotifyButNoLogo), null);
});

test('approved seeds that previously lacked artwork now have https logo_url', () => {
  const required = [
    'FCS Fever Podcast',
    'The Samuel Akem Show',
    'Skyline Sports',
    'Bobcat Insider Podcast',
    'Cat Griz Insider Podcast',
    'Cats Pawd',
    'R&R Cat Cast',
  ];
  for (const name of required) {
    const source = MEDIA_SOURCE_SEEDS.find((entry) => entry.name === name);
    assert.ok(source, `missing seed ${name}`);
    assert.ok(source!.is_approved, `${name} should be approved`);
    assert.ok(
      resolveMediaArtworkUrl(source!)?.startsWith('https://'),
      `${name} should resolve https artwork`,
    );
  }
});

test('suggestion validation requires at least one coverage selection', () => {
  const missing = validateMediaSuggestionInput({
    provider: 'youtube',
    submittedUrl: 'https://www.youtube.com/@fcs',
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.ok(missing.errors.some((error) => /coverage tag/i.test(error)));
  }

  const nationalOnly = validateMediaSuggestionInput({
    provider: 'youtube',
    submittedUrl: 'https://www.youtube.com/@fcs',
    isNational: true,
  });
  assert.equal(nationalOnly.ok, true);

  const blankNotes = validateMediaSuggestionInput({
    provider: 'youtube',
    submittedUrl: 'https://www.youtube.com/@fcs',
    isNational: true,
    notes: '   ',
  });
  assert.equal(blankNotes.ok, true);
  if (blankNotes.ok) {
    assert.equal(blankNotes.value.notes, null);
  }

  const withNotes = validateMediaSuggestionInput({
    provider: 'youtube',
    submittedUrl: 'https://www.youtube.com/@fcs',
    isNational: true,
    notes: '  Great show  ',
  });
  assert.equal(withNotes.ok, true);
  if (withNotes.ok) {
    assert.equal(withNotes.value.notes, 'Great show');
  }

  const teamAndConference = validateMediaSuggestionInput({
    provider: 'spotify',
    submittedUrl: 'https://open.spotify.com/show/abc',
    isNational: true,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
  });
  assert.equal(teamAndConference.ok, true);
  if (teamAndConference.ok) {
    assert.equal(teamAndConference.value.isNational, true);
    assert.deepEqual(teamAndConference.value.teamIds, [MONTANA_STATE_ESPN_TEAM_ID]);
    assert.deepEqual(teamAndConference.value.conferenceIds, ['big-sky']);
  }
});

test('directory lists all approved sources alphabetically', () => {
  const filtered = filterMediaSources(MEDIA_SOURCE_SEEDS, { search: '' });
  assert.ok(filtered.length === MEDIA_SOURCE_SEEDS.filter((s) => s.is_approved).length);
  assert.ok(filtered.some((source) => source.name === 'The FCS Edge'));
  assert.ok(!filtered.some((source) => source.name === 'FCS Delivered'));
  for (let i = 1; i < filtered.length; i += 1) {
    assert.ok(compareMediaSourcesByName(filtered[i - 1]!, filtered[i]!) <= 0);
  }
});

test('search matches name, subtitle, and team labels', () => {
  const bySubtitle = filterMediaSources(MEDIA_SOURCE_SEEDS, {
    search: 'hero sports',
  });
  assert.equal(bySubtitle.length, 1);
  assert.equal(bySubtitle[0]?.name, 'FCS Football Talk Network');

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

test('browse media filters national / team / conference without duplicating cards', () => {
  const approved = filterMediaSources(MEDIA_SOURCE_SEEDS, { search: '' });

  const national = filterMediaSourcesByBrowse(approved, {
    ...createEmptyMediaBrowseFilter(),
    national: true,
  });
  assert.ok(national.every((source) => source.isNational));
  assert.ok(national.some((source) => source.name === 'The FCS Edge'));
  assert.ok(!national.some((source) => source.name === 'Bobcat Insider Podcast'));

  const mtst = filterMediaSourcesByBrowse(approved, {
    ...createEmptyMediaBrowseFilter(),
    teams: [{ id: MONTANA_STATE_ESPN_TEAM_ID, label: 'Montana State' }],
  });
  assert.ok(mtst.some((source) => source.name === 'Bobcat Insider Podcast'));
  assert.ok(mtst.some((source) => source.name === 'Cat Griz Insider Podcast'));
  assert.equal(mtst.length, new Set(mtst.map((source) => source.id)).size);

  const bigSky = filterMediaSourcesByBrowse(approved, {
    ...createEmptyMediaBrowseFilter(),
    conferences: [{ id: 'big-sky', label: 'Big Sky' }],
  });
  assert.ok(bigSky.some((source) => source.name === 'Skyline Sports'));
  assert.equal(
    filterMediaSourcesByBrowse(approved, createEmptyMediaBrowseFilter()).length,
    approved.length,
  );
});

test('browse media multi-select ORs national, teams, and conferences', () => {
  const approved = filterMediaSources(MEDIA_SOURCE_SEEDS, { search: '' });
  let filter = createEmptyMediaBrowseFilter();
  filter = toggleMediaBrowseNational(filter);
  filter = toggleMediaBrowseTeam(filter, {
    id: MONTANA_STATE_ESPN_TEAM_ID,
    label: 'Montana State',
  });
  filter = toggleMediaBrowseConference(filter, { id: 'big-sky', label: 'Big Sky' });

  const chips = getMediaBrowseChips(filter);
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ['National', 'Montana State', 'Big Sky'],
  );
  assert.equal(formatMediaBrowseCoverageLabel(filter), 'National, Montana State, Big Sky');
  assert.deepEqual(mediaBrowseFilterToCoverage(filter), {
    isNational: true,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
  });
  assert.equal(getMediaBrowseBadgeLetter(filter), '3');

  const combined = filterMediaSourcesByBrowse(approved, filter);
  assert.ok(combined.some((source) => source.name === 'The FCS Edge'));
  assert.ok(combined.some((source) => source.name === 'Bobcat Insider Podcast'));
  assert.ok(combined.some((source) => source.name === 'Skyline Sports'));
  assert.equal(combined.length, new Set(combined.map((source) => source.id)).size);

  const afterRemoveNational = removeMediaBrowseChip(filter, chips[0]!);
  assert.equal(afterRemoveNational.national, false);
  assert.equal(getMediaBrowseChips(afterRemoveNational).length, 2);

  const cleared = createEmptyMediaBrowseFilter();
  assert.equal(getMediaBrowseBadgeLetter(cleared), null);
  assert.equal(filterMediaSourcesByBrowse(approved, cleared).length, approved.length);

  const searchedThenBrowsed = filterMediaSourcesByBrowse(
    filterMediaSources(approved, { search: 'bobcat' }),
    {
      ...createEmptyMediaBrowseFilter(),
      teams: [{ id: MONTANA_STATE_ESPN_TEAM_ID, label: 'Montana State' }],
    },
  );
  assert.ok(searchedThenBrowsed.every((source) => /bobcat/i.test(source.name)));
  assert.ok(searchedThenBrowsed.some((source) => source.name === 'Bobcat Insider Podcast'));
});

test('browse team and conference option lists are searchable / alphabetical', () => {
  const approved = filterMediaSources(MEDIA_SOURCE_SEEDS, { search: '' });
  const teams = buildMediaBrowseTeamOptions(approved, []);
  assert.ok(teams.some((team) => team.id === MONTANA_STATE_ESPN_TEAM_ID));
  assert.ok(teams.some((team) => team.id === MONTANA_ESPN_TEAM_ID));
  assert.deepEqual(
    teams.map((team) => team.name),
    [...teams.map((team) => team.name)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );
  assert.ok(filterMediaBrowseTeams(teams, 'montana').length >= 2);

  const conferences = getMediaBrowseConferenceOptions();
  assert.ok(conferences.some((conference) => conference.id === 'big-sky'));
  assert.ok(conferences.some((conference) => conference.id === 'mvfc'));
  assert.deepEqual(
    conferences.map((conference) => conference.name),
    [...conferences.map((conference) => conference.name)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );
});

console.log('\nAll media directory tests passed.');
