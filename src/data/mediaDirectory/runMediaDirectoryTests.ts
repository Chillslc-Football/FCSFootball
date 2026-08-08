/**
 * Offline tests for FCS Media directory validation / filtering / coverage.
 * Run: npm run test:media-directory
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  CONTEXTUAL_MEDIA_INLINE_LIMIT,
  SUGGEST_MEDIA_A11Y_LABEL,
  buildConferenceBrowseFilter,
  buildSuggestMediaHref,
  buildTeamBrowseFilter,
  getMediaCreatorInitials,
  resolveSuggestCoverageFromParams,
  selectConferenceContextualMedia,
  selectTeamContextualMedia,
} from '@/data/mediaDirectory/contextualMedia';
import {
  buildDiscoverBrowseFilterFromHandoff,
  buildDiscoverMediaBrowseSeed,
  queueDiscoverMediaHandoff,
  resetDiscoverMediaHandoffForTests,
  resolveDiscoverMediaHandoffFromParams,
  takeDiscoverMediaHandoff,
} from '@/data/mediaDirectory/discoverMediaHandoff';
import {
  buildDiscoverConferenceMediaHref,
  buildDiscoverTeamMediaHref,
  prepareDiscoverConferenceMediaNavigation,
  prepareDiscoverTeamMediaNavigation,
} from '@/data/mediaDirectory/discoverMediaNavigation';
import {
  buildMediaBrowseTeamOptions,
  cloneMediaBrowseFilter,
  createEmptyMediaBrowseFilter,
  filterMediaBrowseTeams,
  filterMediaSourcesByBrowse,
  formatCompactMediaBrowseCoverageSummary,
  formatMediaBrowseCoverageLabel,
  getMediaBrowseBadgeLetter,
  getMediaBrowseChips,
  getMediaBrowseConferenceOptions,
  mediaBrowseFilterToCoverage,
  removeMediaBrowseChip,
  toggleMediaBrowseConference,
  toggleMediaBrowseNational,
  toggleMediaBrowseTeam,
  unionMediaBrowseFilters,
} from '@/data/mediaDirectory/mediaBrowse';
import { normalizeMediaSourceCoverage } from '@/data/mediaDirectory/mediaCoverage';
import {
  MEDIA_PLATFORM_LINK_FIELD_ERRORS,
  formatMediaPlatformLinksForEmail,
  normalizeMediaPlatformLinks,
} from '@/data/mediaDirectory/mediaPlatformLinks';
import {
  buildSubmitMediaCreatorUpdateRpcPayload,
  mediaSourceToUpdateLinkRows,
  validateMediaCreatorUpdateInput,
} from '@/data/mediaDirectory/mediaCreatorUpdate';
import {
  detectMediaPlatformFromUrl,
  getMediaPlatformUrlMismatchError,
  normalizeSuggestLinkUrl,
} from '@/data/mediaDirectory/mediaLinkUrlDetection';
import {
  createEmptyMediaLinkRow,
  formatMediaLinkActionLabel,
  getMediaLinkRowBrowseFilter,
  validateMediaLinkRows,
} from '@/data/mediaDirectory/mediaLinkRows';
import {
  buildMediaSuggestionCoverageLabels,
  resolveMediaSuggestionConferenceNames,
  resolveMediaSuggestionTeamNames,
} from '@/data/mediaDirectory/mediaSuggestionCoverageLabels';
import {
  buildMediaSuggestionNotifyPayload,
  buildMediaSuggestionReplyMailto,
  formatMediaSuggestionOwnerEmail,
  isValidSubmitterEmail,
  normalizeSubmitterEmail,
} from '@/data/mediaDirectory/mediaSuggestionNotifyEmail';
import {
  MEDIA_SUGGESTION_OUTCOME_FROM,
  formatMediaSuggestionOutcomeEmail,
} from '@/data/mediaDirectory/mediaSuggestionOutcomeEmail';
import {
  MEDIA_SUGGESTION_REVIEW_JSON_CONTENT_TYPE,
  buildMediaSuggestionReviewCorsHeaders,
  buildMediaSuggestionReviewDto,
  buildMediaSuggestionReviewGetError,
  buildMediaSuggestionReviewGetSuccess,
  buildMediaSuggestionReviewPageCopy,
  buildMediaSuggestionReviewPostError,
  buildMediaSuggestionReviewPostSuccess,
  createMediaSuggestionReviewJsonResponse,
  isAllowedMediaSuggestionReviewOrigin,
  isMediaSuggestionReviewJsonContentType,
} from '@/data/mediaDirectory/mediaSuggestionReviewApi';
import {
  createMediaSuggestionReviewNonce,
  getMediaSuggestionReviewTokenTtlSeconds,
  hashMediaSuggestionReviewNonce,
  issueMediaSuggestionReviewToken,
  verifyMediaSuggestionReviewToken,
} from '@/data/mediaDirectory/mediaSuggestionReviewToken';
import { resolveMediaScopeBadges } from '@/data/mediaDirectory/mediaScopeBadge';
import {
  buildSubmitMediaSuggestionRpcPayload,
  compareMediaSourcesByName,
  filterMediaSources,
  filterMediaSourcesByTeam,
  isLegacyMediaSuggestionProviderError,
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
  const merged = {
    subtitle: null,
    description: null,
    scope: 'national' as const,
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
    links: [],
    ...partial,
  };
  if (!partial.links) {
    const derived = [];
    if (merged.spotify_url) {
      derived.push({
        platform: 'spotify' as const,
        label: null,
        url: merged.spotify_url,
        sortOrder: derived.length,
      });
    }
    if (merged.youtube_url) {
      derived.push({
        platform: 'youtube' as const,
        label: null,
        url: merged.youtube_url,
        sortOrder: derived.length,
      });
    }
    if (merged.x_url) {
      derived.push({
        platform: 'x' as const,
        label: null,
        url: merged.x_url,
        sortOrder: derived.length,
      });
    }
    if (merged.apple_podcast_url) {
      derived.push({
        platform: 'apple' as const,
        label: null,
        url: merged.apple_podcast_url,
        sortOrder: derived.length,
      });
    }
    merged.links = derived;
  }
  return merged;
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

test('restore media source logos migration fills blank logos only', () => {
  const migration = readFileSync(
    path.resolve(
      process.cwd(),
      'supabase/migrations/20260802140000_restore_media_source_logos.sql',
    ),
    'utf8',
  );

  assert.match(migration, /nullif\(trim\(coalesce\(s\.logo_url, ''\)\), ''\) is null/);
  assert.match(migration, /logo_url = coalesce\(v_logo, logo_url\)/);
  assert.match(migration, /Preserve existing artwork when admin leaves the artwork field blank/);
  assert.match(migration, /Preserve existing source artwork when suggestion has no logo/);
  assert.match(migration, /trim\(logo_url\) = ''/);

  const approvedWithArtwork = MEDIA_SOURCE_SEEDS.filter(
    (source) => source.is_approved && resolveMediaArtworkUrl(source),
  );
  assert.equal(approvedWithArtwork.length, 15);

  for (const source of approvedWithArtwork) {
    assert.match(
      migration,
      new RegExp(source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `migration missing ${source.name}`,
    );
    const logo = resolveMediaArtworkUrl(source)!;
    assert.match(
      migration,
      new RegExp(logo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `migration missing logo for ${source.name}`,
    );
  }

  // Unapproved seed without artwork must not be invented in the restore migration.
  const delivered = MEDIA_SOURCE_SEEDS.find((source) => source.name === 'FCS Delivered');
  assert.ok(delivered);
  assert.equal(delivered!.is_approved, false);
  assert.equal(resolveMediaArtworkUrl(delivered!), null);
  assert.equal(migration.includes('FCS Delivered'), false);
});

test('suggestion validation requires name, coverage, and at least one link', () => {
  const missingCoverage = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    platformLinks: { youtube: 'https://www.youtube.com/@fcs' },
  });
  assert.equal(missingCoverage.ok, false);
  if (!missingCoverage.ok) {
    assert.ok(
      missingCoverage.errors.some((error) => /coverage/i.test(error)) ||
        Boolean(missingCoverage.fieldErrors['links.0.coverage']),
    );
    assert.match(
      String(missingCoverage.fieldErrors['links.0.coverage'] ?? ''),
      /Select coverage for Link 1/i,
    );
  }

  const missingName = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    platformLinks: { youtube: 'https://www.youtube.com/@fcs' },
    isNational: true,
  });
  assert.equal(missingName.ok, false);
  if (!missingName.ok) {
    assert.ok(missingName.fieldErrors.name);
  }

  const nationalOnly = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    platformLinks: { youtube: 'https://www.youtube.com/@fcs' },
    isNational: true,
  });
  assert.equal(nationalOnly.ok, true);

  const blankNotes = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    platformLinks: { youtube: 'https://www.youtube.com/@fcs' },
    isNational: true,
    notes: '   ',
  });
  assert.equal(blankNotes.ok, true);
  if (blankNotes.ok) {
    assert.equal(blankNotes.value.notes, null);
  }

  const withNotes = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    platformLinks: { youtube: 'https://www.youtube.com/@fcs' },
    isNational: true,
    notes: '  Great show  ',
  });
  assert.equal(withNotes.ok, true);
  if (withNotes.ok) {
    assert.equal(withNotes.value.notes, 'Great show');
  }

  const teamAndConference = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'Bobcat Show',
    platformLinks: { spotify: 'https://open.spotify.com/show/abc' },
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

test('submit_media_suggestion RPC payload matches live multi-link signature', () => {
  const rpcKeys = [
    'p_name',
    'p_links',
    'p_platform_links',
    'p_is_national',
    'p_conference_ids',
    'p_team_ids',
    'p_notes',
    'p_description',
    'p_submitter_email',
    'p_coverage_labels',
  ] as const;

  function assertRpc(input: Parameters<typeof validateMediaSuggestionInput>[0]) {
    const validated = validateMediaSuggestionInput({
      submitterEmail: 'fan@example.com',
      ...input,
    });
    assert.equal(validated.ok, true, JSON.stringify(input));
    if (!validated.ok) return;
    const payload = buildSubmitMediaSuggestionRpcPayload(validated.value);
    assert.deepEqual(Object.keys(payload).sort(), [...rpcKeys].sort());
    assert.equal(payload.p_name, validated.value.name);
    assert.deepEqual(payload.p_platform_links, validated.value.platformLinks);
    assert.equal(payload.p_links.length, validated.value.links.length);
    assert.equal(payload.p_is_national, validated.value.isNational);
    assert.deepEqual(payload.p_conference_ids, validated.value.conferenceIds);
    assert.deepEqual(payload.p_team_ids, validated.value.teamIds);
    assert.equal(payload.p_notes, validated.value.notes ?? null);
    assert.equal(payload.p_description, validated.value.description ?? null);
    assert.equal(payload.p_submitter_email, validated.value.submitterEmail);
    return payload;
  }

  // National only + one platform link
  const national = assertRpc({
    name: 'National Show',
    isNational: true,
    platformLinks: { youtube: 'https://www.youtube.com/@fcs' },
  });
  assert.equal(national?.p_is_national, true);
  assert.deepEqual(national?.p_team_ids, []);
  assert.deepEqual(national?.p_conference_ids, []);
  assert.deepEqual(national?.p_platform_links, {
    youtube: 'https://www.youtube.com/@fcs',
  });
  assert.equal(national?.p_notes, null);
  assert.equal(national?.p_description, null);
  assert.equal(national?.p_submitter_email, 'fan@example.com');

  // One team
  const oneTeam = assertRpc({
    name: 'Team Show',
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    platformLinks: { website: 'https://example.com' },
  });
  assert.deepEqual(oneTeam?.p_team_ids, [MONTANA_STATE_ESPN_TEAM_ID]);
  assert.equal(oneTeam?.p_is_national, false);

  // Multiple teams
  const multiTeam = assertRpc({
    name: 'Multi Team Show',
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
    platformLinks: { spotify: 'https://open.spotify.com/show/abc' },
  });
  assert.deepEqual(multiTeam?.p_team_ids, [
    MONTANA_STATE_ESPN_TEAM_ID,
    MONTANA_ESPN_TEAM_ID,
  ]);

  // One conference
  const oneConf = assertRpc({
    name: 'Conference Show',
    conferenceIds: ['big-sky'],
    platformLinks: { apple: 'https://podcasts.apple.com/us/podcast/id1' },
  });
  assert.deepEqual(oneConf?.p_conference_ids, ['big-sky']);

  // Multiple conferences
  const multiConf = assertRpc({
    name: 'Multi Conference Show',
    conferenceIds: ['big-sky', 'mvfc'],
    platformLinks: { rss: 'https://example.com/feed.xml' },
  });
  assert.deepEqual(multiConf?.p_conference_ids, ['big-sky', 'mvfc']);

  // Mixed national + teams + conferences + multiple links + notes + description
  const mixed = assertRpc({
    name: 'Mixed Coverage Show',
    isNational: true,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
    conferenceIds: ['big-sky', 'mvfc'],
    description: '  Public show blurb  ',
    notes: '  Optional note  ',
    platformLinks: {
      website: 'https://example.com',
      youtube: 'https://www.youtube.com/@fcs',
      spotify: 'https://open.spotify.com/show/abc',
    },
    coverageLabels: buildMediaSuggestionCoverageLabels({
      teams: [
        { id: MONTANA_STATE_ESPN_TEAM_ID, label: 'Montana State' },
        { id: MONTANA_ESPN_TEAM_ID, label: 'Montana' },
      ],
      conferences: [
        { id: 'big-sky', label: 'Big Sky' },
        { id: 'mvfc', label: 'Missouri Valley Football Conference' },
      ],
    }),
  });
  assert.equal(mixed?.p_is_national, true);
  assert.deepEqual(mixed?.p_team_ids, [
    MONTANA_STATE_ESPN_TEAM_ID,
    MONTANA_ESPN_TEAM_ID,
  ]);
  assert.deepEqual(mixed?.p_conference_ids, ['big-sky', 'mvfc']);
  assert.equal(mixed?.p_description, 'Public show blurb');
  assert.equal(mixed?.p_notes, 'Optional note');
  assert.deepEqual(mixed?.p_platform_links, {
    website: 'https://example.com',
    youtube: 'https://www.youtube.com/@fcs',
    spotify: 'https://open.spotify.com/show/abc',
  });
  assert.equal(mixed?.p_coverage_labels.teams?.[MONTANA_STATE_ESPN_TEAM_ID], 'Montana State');
});

test('suggestion platform links: field-specific errors, trim, and email format', () => {
  const noLinks = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    isNational: true,
    platformLinks: { website: '  ', spotify: '' },
  });
  assert.equal(noLinks.ok, false);
  if (!noLinks.ok) {
    assert.equal(noLinks.fieldErrors.links, 'Add at least one link.');
    assert.ok(noLinks.errors.includes('Add at least one link.'));
    assert.equal(noLinks.fieldErrors.website, undefined);
    assert.ok(!noLinks.errors.some((error) => isLegacyMediaSuggestionProviderError(error)));
  }

  const websiteOnly = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'Website Only',
    isNational: true,
    platformLinks: { website: 'https://example.com' },
  });
  assert.equal(websiteOnly.ok, true);

  const appleOnly = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'Apple Only',
    isNational: true,
    platformLinks: { apple: 'https://podcasts.apple.com/us/podcast/id1' },
  });
  assert.equal(appleOnly.ok, true);

  const youtubeOnly = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'YouTube Only',
    isNational: true,
    platformLinks: { youtube: 'https://www.youtube.com/@fcs' },
  });
  assert.equal(youtubeOnly.ok, true);

  const rssOnly = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'RSS Only',
    isNational: true,
    platformLinks: { rss: 'https://example.com/feed.xml' },
  });
  assert.equal(rssOnly.ok, true);

  const invalidWebsite = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    isNational: true,
    platformLinks: { website: 'not-a-url' },
  });
  assert.equal(invalidWebsite.ok, false);
  if (!invalidWebsite.ok) {
    assert.match(String(invalidWebsite.fieldErrors['links.0.url'] ?? ''), /valid/i);
  }

  const invalidYoutube = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    isNational: true,
    platformLinks: { youtube: 'ftp://youtube.com/x' },
  });
  assert.equal(invalidYoutube.ok, false);
  if (!invalidYoutube.ok) {
    assert.match(String(invalidYoutube.fieldErrors['links.0.url'] ?? ''), /valid/i);
  }

  const validPlusInvalid = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'FCS Show',
    isNational: true,
    linkRows: [
      { platform: 'website', label: '', url: 'not-a-url' },
      { platform: 'youtube', label: '', url: 'https://www.youtube.com/@fcs' },
    ],
  });
  assert.equal(validPlusInvalid.ok, false);
  if (!validPlusInvalid.ok) {
    assert.match(String(validPlusInvalid.fieldErrors['links.0.url'] ?? ''), /valid/i);
    assert.equal(validPlusInvalid.fieldErrors['links.1.url'], undefined);
  }

  const singleLinkCases = [
    { youtube: 'https://www.youtube.com/@fcs' },
    { apple: 'https://podcasts.apple.com/us/podcast/id1' },
    { website: 'https://example.com' },
    { spotify: 'https://open.spotify.com/show/abc' },
    { rss: 'https://example.com/feed.xml' },
    { other: 'https://example.com/listen' },
    { x: 'https://x.com/fcs' },
    { facebook: 'https://facebook.com/fcs' },
    { instagram: 'https://instagram.com/fcs' },
  ] as const;

  for (const platformLinks of singleLinkCases) {
    const result = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
      name: 'Single Link Show',
      isNational: true,
      platformLinks: {
        website: '',
        spotify: '',
        apple: '',
        youtube: '',
        x: '',
        facebook: '',
        instagram: '',
        rss: '',
        other: '',
        ...platformLinks,
      },
    });
    assert.equal(result.ok, true, `expected pass for ${JSON.stringify(platformLinks)}`);
    if (result.ok) {
      assert.equal(Object.keys(result.value.platformLinks).length, 1);
    }
  }

  const trimmed = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: '  FCS Show  ',
    isNational: true,
    platformLinks: {
      spotify: '  https://open.spotify.com/show/abc  ',
      youtube: '   ',
      website: '',
      apple: '',
    },
  });
  assert.equal(trimmed.ok, true);
  if (trimmed.ok) {
    assert.equal(trimmed.value.name, 'FCS Show');
    assert.deepEqual(trimmed.value.platformLinks, {
      spotify: 'https://open.spotify.com/show/abc',
    });
  }

  const several = validateMediaSuggestionInput({
    submitterEmail: 'fan@example.com',
    name: 'Multi Link Show',
    isNational: true,
    platformLinks: {
      website: 'https://example.com',
      spotify: 'https://open.spotify.com/show/abc',
      apple: 'https://podcasts.apple.com/us/podcast/id1',
      youtube: 'https://www.youtube.com/@fcs',
      x: '',
    },
  });
  assert.equal(several.ok, true);
  if (several.ok) {
    assert.deepEqual(several.value.platformLinks, {
      website: 'https://example.com',
      spotify: 'https://open.spotify.com/show/abc',
      apple: 'https://podcasts.apple.com/us/podcast/id1',
      youtube: 'https://www.youtube.com/@fcs',
    });
  }

  assert.deepEqual(MEDIA_PLATFORM_LINK_FIELD_ERRORS, {
    website: 'Enter a valid website URL.',
    spotify: 'Enter a valid Spotify URL.',
    apple: 'Enter a valid Apple Podcasts URL.',
    youtube: 'Enter a valid YouTube URL.',
    x: 'Enter a valid X URL.',
    facebook: 'Enter a valid Facebook URL.',
    instagram: 'Enter a valid Instagram URL.',
    rss: 'Enter a valid RSS feed URL.',
    other: 'Enter a valid URL.',
  });

  const stored = normalizeMediaPlatformLinks({
    website: ' https://example.com ',
    other: '',
    rss: null,
  });
  assert.deepEqual(stored, { website: 'https://example.com' });

  const email = formatMediaPlatformLinksForEmail({
    website: 'https://example.com',
    spotify: 'https://open.spotify.com/show/abc',
    youtube: 'https://www.youtube.com/@fcs',
  });
  assert.match(email, /^Platform Links\n/);
  assert.match(email, /Website: https:\/\/example\.com/);
  assert.match(email, /Spotify: https:\/\/open\.spotify\.com\/show\/abc/);
  assert.match(email, /YouTube: https:\/\/www\.youtube\.com\/@fcs/);
  assert.equal(email.includes('Apple Podcasts'), false);
});

test('submitter email validation and storage normalization', () => {
  assert.equal(isValidSubmitterEmail('  Fan@Example.COM '), true);
  assert.equal(normalizeSubmitterEmail('  Fan@Example.COM '), 'fan@example.com');
  assert.equal(isValidSubmitterEmail('name@gmail.com'), true);
  assert.equal(isValidSubmitterEmail('creator@fcspulse.com'), true);
  assert.equal(isValidSubmitterEmail('bob.smith@example.com'), true);
  assert.equal(isValidSubmitterEmail('bob+podcast@example.com'), true);
  assert.equal(isValidSubmitterEmail('bob_smith@example.com'), true);
  assert.equal(isValidSubmitterEmail('bob.smith+podcast@example.com'), true);
  assert.equal(isValidSubmitterEmail(' name@gmail.com '), true);
  assert.equal(normalizeSubmitterEmail(' name@gmail.com '), 'name@gmail.com');
  assert.equal(isValidSubmitterEmail('bob'), false);
  assert.equal(isValidSubmitterEmail('bob@'), false);
  assert.equal(isValidSubmitterEmail('@gmail.com'), false);
  assert.equal(isValidSubmitterEmail('bob gmail.com'), false);
  assert.equal(isValidSubmitterEmail('not-an-email'), false);

  const missing = validateMediaSuggestionInput({
    name: 'FCS Show',
    isNational: true,
    platformLinks: { website: 'https://example.com' },
  });
  assert.equal(missing.ok, true);
  if (missing.ok) {
    assert.equal(missing.value.submitterEmail, '');
  }

  const blank = validateMediaSuggestionInput({
    name: 'FCS Show',
    isNational: true,
    submitterEmail: '   ',
    platformLinks: { website: 'https://example.com' },
  });
  assert.equal(blank.ok, true);
  if (blank.ok) {
    assert.equal(blank.value.submitterEmail, '');
  }

  const invalid = validateMediaSuggestionInput({
    name: 'FCS Show',
    isNational: true,
    submitterEmail: 'bad',
    platformLinks: { website: 'https://example.com' },
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.fieldErrors.submitterEmail, 'Enter a valid email address.');
  }

  const ok = validateMediaSuggestionInput({
    name: 'FCS Show',
    isNational: true,
    submitterEmail: '  Fan@Example.COM ',
    platformLinks: { website: 'https://example.com' },
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.submitterEmail, 'fan@example.com');
  }
});

test('repeatable links validation and public action labels', () => {
  const repeated = validateMediaLinkRows([
    {
      platform: 'youtube',
      label: 'Main',
      url: 'https://youtube.com/@main',
      isNational: true,
    },
    {
      platform: 'youtube',
      label: 'Podcast',
      url: 'https://youtube.com/@podcast',
      isNational: true,
    },
    {
      platform: 'spotify',
      label: 'Weekly Show',
      url: 'https://open.spotify.com/show/1',
      isNational: true,
    },
  ]);
  assert.equal(repeated.ok, true);
  if (repeated.ok) {
    assert.equal(formatMediaLinkActionLabel(repeated.value[0]!), 'YouTube · Main');
    assert.equal(formatMediaLinkActionLabel(repeated.value[1]!), 'YouTube · Podcast');
    assert.equal(formatMediaLinkActionLabel({ platform: 'spotify', label: null }), 'Spotify');
  }

  const validated = validateMediaSuggestionInput({
    name: 'Multi Link Show',
    submitterEmail: 'fan@example.com',
    isNational: true,
    linkRows: [
      { platform: 'youtube', label: 'Main', url: 'https://youtube.com/@main' },
      { platform: 'youtube', label: 'Clips', url: 'https://youtube.com/@clips' },
      { platform: 'website', label: '', url: '' },
    ],
  });
  assert.equal(validated.ok, true);
  if (validated.ok) {
    assert.equal(validated.value.links.length, 2);
    const payload = buildSubmitMediaSuggestionRpcPayload(validated.value);
    assert.equal(payload.p_links.length, 2);
    assert.equal(payload.p_links[0]?.label, 'Main');
    assert.equal(payload.p_links[0]?.is_national, true);
    assert.deepEqual(payload.p_links[0]?.team_ids, []);
    assert.deepEqual(payload.p_links[0]?.conference_ids, []);
  }

  const email = formatMediaSuggestionOwnerEmail({
    id: 'abc',
    name: 'Multi Link Show',
    links: [
      {
        platform: 'youtube',
        label: 'Main Channel',
        url: 'https://youtube.com/@main',
        sortOrder: 0,
        isNational: true,
        teamIds: [],
        conferenceIds: [],
      },
      {
        platform: 'youtube',
        label: 'Podcast',
        url: 'https://youtube.com/@podcast',
        sortOrder: 1,
        isNational: true,
        teamIds: [],
        conferenceIds: [],
      },
    ],
    platformLinks: {},
    isNational: true,
    teamIds: [],
    conferenceIds: [],
    notes: null,
    submitterEmail: null,
    status: 'pending',
    submittedAt: '2026-08-01T17:00:00.000Z',
    reviewUrl: 'https://admin.fcspulse.com/suggestions/abc',
  });
  assert.match(email.text, /YouTube · Main Channel/);
  assert.match(email.text, /YouTube · Podcast/);
  assert.match(email.html, /YouTube · Main Channel/);
});

test('per-link coverage: independent state, compact summary, union payload', () => {
  const shared = {
    national: false,
    teams: [{ id: MONTANA_STATE_ESPN_TEAM_ID, label: 'Montana State' }],
    conferences: [{ id: 'big-sky', label: 'Big Sky' }],
  };
  const link1 = createEmptyMediaLinkRow(0, shared);
  const link2 = createEmptyMediaLinkRow(1, shared);
  link2.coverage = cloneMediaBrowseFilter(shared);
  link2.coverage!.teams = [
    ...link2.coverage!.teams,
    { id: MONTANA_ESPN_TEAM_ID, label: 'Montana' },
  ];
  assert.equal(getMediaLinkRowBrowseFilter(link1).teams.length, 1);
  assert.equal(getMediaLinkRowBrowseFilter(link2).teams.length, 2);

  const compact = formatCompactMediaBrowseCoverageSummary(
    {
      national: true,
      teams: [
        { id: MONTANA_STATE_ESPN_TEAM_ID, label: 'Montana State' },
        { id: '70', label: 'Idaho' },
      ],
      conferences: [
        { id: 'big-sky', label: 'Big Sky' },
        { id: 'mvfc', label: 'MVFC' },
      ],
    },
    2,
  );
  assert.equal(compact, 'National, Montana State +3');

  const missingLinkCoverage = validateMediaLinkRows([
    {
      platform: 'youtube',
      url: 'https://youtube.com/@a',
      coverage: createEmptyMediaBrowseFilter(),
    },
  ]);
  assert.equal(missingLinkCoverage.ok, false);
  if (!missingLinkCoverage.ok) {
    assert.match(String(missingLinkCoverage.fieldErrors['links.0.coverage']), /Link 1/);
  }

  const distinct = validateMediaSuggestionInput({
    name: 'Bobcat Insider',
    submitterEmail: 'fan@example.com',
    linkRows: [
      {
        platform: 'youtube',
        url: 'https://youtube.com/@a',
        coverage: {
          national: true,
          teams: [{ id: MONTANA_STATE_ESPN_TEAM_ID, label: 'Montana State' }],
          conferences: [{ id: 'big-sky', label: 'Big Sky' }],
        },
      },
      {
        platform: 'spotify',
        url: 'https://open.spotify.com/show/b',
        coverage: {
          national: false,
          teams: [{ id: '70', label: 'Idaho' }],
          conferences: [{ id: 'big-sky', label: 'Big Sky' }],
        },
      },
    ],
  });
  assert.equal(distinct.ok, true);
  if (distinct.ok) {
    assert.equal(distinct.value.links[0]?.isNational, true);
    assert.deepEqual(distinct.value.links[0]?.teamIds, [MONTANA_STATE_ESPN_TEAM_ID]);
    assert.deepEqual(distinct.value.links[1]?.teamIds, ['70']);
    assert.equal(distinct.value.isNational, true);
    assert.ok(distinct.value.teamIds.includes(MONTANA_STATE_ESPN_TEAM_ID));
    assert.ok(distinct.value.teamIds.includes('70'));
    assert.deepEqual(distinct.value.conferenceIds, ['big-sky']);
    const payload = buildSubmitMediaSuggestionRpcPayload(distinct.value);
    assert.equal(payload.p_links[0]?.is_national, true);
    assert.deepEqual(payload.p_links[0]?.team_ids, [MONTANA_STATE_ESPN_TEAM_ID]);
    assert.deepEqual(payload.p_links[1]?.team_ids, ['70']);
    assert.equal(payload.p_is_national, true);
    assert.ok(payload.p_team_ids.includes('70'));
    const union = unionMediaBrowseFilters([
      getMediaLinkRowBrowseFilter(link1),
      getMediaLinkRowBrowseFilter(link2),
    ]);
    assert.equal(union.teams.length, 2);
  }
});

test('creator update validation requires email, representation, and links', () => {
  const missing = validateMediaCreatorUpdateInput({
    mediaSourceId: 'source-1',
    creatorName: 'FCS Nation',
    linkRows: [
      {
        platform: 'youtube',
        url: 'https://youtube.com/@fcs',
        isNational: true,
      },
    ],
    representsCreator: false,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.fieldErrors.submitterEmail, 'Email is required.');
    assert.match(String(missing.fieldErrors.representsCreator), /represent/i);
  }

  const spacedEmail = validateMediaCreatorUpdateInput({
    mediaSourceId: 'source-1',
    creatorName: 'FCS Nation',
    submitterEmail: ' name@gmail.com ',
    representsCreator: true,
    linkRows: [
      {
        platform: 'youtube',
        url: 'https://youtube.com/@fcs',
        isNational: true,
      },
    ],
  });
  assert.equal(spacedEmail.ok, true);
  if (spacedEmail.ok) {
    assert.equal(spacedEmail.value.submitterEmail, 'name@gmail.com');
  }

  const ok = validateMediaCreatorUpdateInput({
    mediaSourceId: 'source-1',
    creatorName: 'FCS Nation',
    description: 'Updated blurb',
    submitterEmail: 'Creator@Example.com',
    representsCreator: true,
    linkRows: [
      {
        platform: 'youtube',
        url: 'youtube.com/@fcs',
        coverage: {
          national: false,
          teams: [{ id: MONTANA_STATE_ESPN_TEAM_ID, label: 'Montana State' }],
          conferences: [{ id: 'big-sky', label: 'Big Sky' }],
        },
      },
      {
        platform: 'spotify',
        url: 'https://open.spotify.com/show/1',
        isNational: true,
      },
    ],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.submitterEmail, 'creator@example.com');
    assert.equal(ok.value.links.length, 2);
    assert.equal(ok.value.links[0]?.url, 'https://youtube.com/@fcs');
    assert.equal(ok.value.isNational, true);
    assert.ok(ok.value.teamIds.includes(MONTANA_STATE_ESPN_TEAM_ID));
    assert.deepEqual(ok.value.conferenceIds, ['big-sky']);
    const payload = buildSubmitMediaCreatorUpdateRpcPayload(ok.value);
    assert.equal(payload.p_media_source_id, 'source-1');
    assert.equal(payload.p_represents_creator, true);
    assert.equal(payload.p_description, 'Updated blurb');
    assert.equal(payload.p_links[0]?.is_national, false);
    assert.deepEqual(payload.p_links[0]?.team_ids, [MONTANA_STATE_ESPN_TEAM_ID]);
    assert.equal(payload.p_links[1]?.is_national, true);
  }

  const prefilled = mediaSourceToUpdateLinkRows(
    baseSource({
      id: 'source-1',
      name: 'FCS Nation',
      description: 'About',
      isNational: true,
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      conferenceIds: ['big-sky'],
      links: [
        {
          platform: 'youtube',
          label: 'Main',
          url: 'https://youtube.com/@fcs',
          sortOrder: 0,
          isNational: false,
          teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
          conferenceIds: [],
        },
      ],
    }),
  );
  assert.equal(prefilled.length, 1);
  assert.equal(prefilled[0]?.url, 'https://youtube.com/@fcs');
  assert.equal(prefilled[0]?.label, 'Main');
  assert.equal(prefilled[0]?.coverage?.teams[0]?.id, MONTANA_STATE_ESPN_TEAM_ID);
});

test('suggest link URL normalization and platform detection', () => {
  const cases: Array<{ input: string; platform: string; normalizedPrefix?: string }> = [
    { input: 'youtube.com/@example', platform: 'youtube', normalizedPrefix: 'https://youtube.com/' },
    { input: 'youtu.be/abc123', platform: 'youtube' },
    { input: 'open.spotify.com/show/abc', platform: 'spotify' },
    { input: 'podcasts.apple.com/us/podcast/example/id123', platform: 'apple' },
    { input: 'x.com/example', platform: 'x' },
    { input: 'twitter.com/example', platform: 'x' },
    { input: 'instagram.com/example', platform: 'instagram' },
    { input: 'fcspulse.com', platform: 'website' },
    { input: 'unknowncreatorwebsite.com', platform: 'website' },
  ];

  for (const item of cases) {
    const normalized = normalizeSuggestLinkUrl(item.input);
    assert.match(normalized, /^https:\/\//i);
    if (item.normalizedPrefix) {
      assert.ok(normalized.startsWith(item.normalizedPrefix));
    }
    assert.equal(detectMediaPlatformFromUrl(item.input), item.platform);
    assert.equal(detectMediaPlatformFromUrl(normalized), item.platform);
  }

  assert.equal(detectMediaPlatformFromUrl('https://example.com/feed.xml'), 'rss');
  assert.equal(detectMediaPlatformFromUrl('facebook.com/page'), 'facebook');
  assert.equal(detectMediaPlatformFromUrl('fb.com/page'), 'facebook');

  // Manual override remains possible: Website/Other vs specific host is allowed.
  assert.equal(
    getMediaPlatformUrlMismatchError('other', 'https://youtube.com/@example'),
    null,
  );
  assert.equal(
    getMediaPlatformUrlMismatchError('website', 'https://youtube.com/@example'),
    null,
  );
  assert.match(
    String(getMediaPlatformUrlMismatchError('youtube', 'https://open.spotify.com/show/1')),
    /Spotify/,
  );

  // Bare domains submit after normalization (with coverage).
  const bare = validateMediaLinkRows([
    {
      platform: 'youtube',
      url: 'youtube.com/@example',
      isNational: true,
    },
  ]);
  assert.equal(bare.ok, true);
  if (bare.ok) {
    assert.equal(bare.value[0]?.url, 'https://youtube.com/@example');
    assert.equal(bare.value[0]?.platform, 'youtube');
  }

  // Unknown domain defaults to Website, not Other.
  const site = validateMediaLinkRows([
    {
      platform: 'website',
      url: 'unknowncreatorwebsite.com',
      isNational: true,
    },
  ]);
  assert.equal(site.ok, true);
  if (site.ok) {
    assert.equal(site.value[0]?.url, 'https://unknowncreatorwebsite.com');
    assert.equal(site.value[0]?.platform, 'website');
  }
});

test('owner notification email resolves names, HTML links, reply-to, and Media Admin link', () => {
  const notify = buildMediaSuggestionNotifyPayload('  abc-123  ', {
    teams: { '2000': 'Eastern Washington' },
    conferences: { 'big-sky': 'Big Sky' },
  });
  assert.deepEqual(notify, {
    suggestion_id: 'abc-123',
    coverage_labels: {
      teams: { '2000': 'Eastern Washington' },
      conferences: { 'big-sky': 'Big Sky' },
    },
  });

  assert.deepEqual(
    resolveMediaSuggestionTeamNames([MONTANA_STATE_ESPN_TEAM_ID, '999'], {
      teams: { '999': 'Custom Team' },
    }),
    ['Montana State', 'Custom Team'],
  );
  assert.deepEqual(resolveMediaSuggestionConferenceNames(['big-sky', 'mvfc']), [
    'Big Sky',
    'Missouri Valley Football Conference',
  ]);

  const reviewUrl = 'https://admin.fcspulse.com/suggestions/abc-123';

  const email = formatMediaSuggestionOwnerEmail({
    id: 'abc-123',
    name: 'Skyline Sports',
    platformLinks: {
      website: 'https://example.com',
      youtube: 'https://www.youtube.com/@fcs',
      spotify: '',
    },
    isNational: true,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    coverageLabels: {
      teams: { [MONTANA_STATE_ESPN_TEAM_ID]: 'Montana State' },
      conferences: { 'big-sky': 'Big Sky' },
    },
    notes: 'Great show',
    submitterEmail: 'fan@example.com',
    status: 'pending',
    submittedAt: '2026-08-01T17:00:00.000Z',
    reviewUrl,
  });

  assert.equal(email.subject, 'New FCS Pulse media suggestion: Skyline Sports');
  assert.equal(email.replyTo, 'fan@example.com');
  assert.match(email.text, /Creator or Podcast Name: Skyline Sports/);
  assert.match(email.text, /Website/);
  assert.match(email.text, /https:\/\/example\.com/);
  assert.match(email.text, /YouTube/);
  assert.match(email.text, /https:\/\/www\.youtube\.com\/@fcs/);
  assert.equal(email.text.includes('Spotify'), false);
  assert.match(email.text, /National: Yes/);
  assert.match(email.text, /Teams: Montana State/);
  assert.match(email.text, /Conferences: Big Sky/);
  assert.match(email.text, /Submitter Email: fan@example.com/);
  assert.match(email.html, /href="https:\/\/example\.com"/);
  assert.match(email.html, /href="https:\/\/www\.youtube\.com\/@fcs"/);
  assert.match(email.html, /Review Suggestion|Open in Media Admin/);
  assert.match(email.html, /href="https:\/\/admin\.fcspulse\.com\/suggestions\/abc-123"/);
  assert.equal(email.html.includes('/review?token='), false);
  assert.equal(email.html.includes('/functions/v1/review-media-suggestion'), false);

  const replyMailto = buildMediaSuggestionReplyMailto({
    submitterEmail: 'fan@example.com',
    creatorName: 'Skyline Sports',
  });
  assert.match(email.html, /Reply/);
  assert.ok(
    email.html.includes(replyMailto.replace(/&/g, '&amp;')) ||
      email.html.includes('mailto:fan%40example.com'),
  );
  assert.match(replyMailto, /^mailto:/);
  assert.match(replyMailto, /fan%40example\.com|fan@example\.com/);
  assert.match(
    replyMailto,
    /Question%20about%20your%20FCS%20Pulse%20media%20suggestion/,
  );

  const older = formatMediaSuggestionOwnerEmail({
    id: 'old-1',
    name: 'Legacy Show',
    platformLinks: { website: 'https://example.com' },
    isNational: true,
    teamIds: [],
    conferenceIds: [],
    notes: null,
    submitterEmail: null,
    status: 'pending',
    submittedAt: '2026-08-01T17:00:00.000Z',
    reviewUrl,
  });
  assert.equal(older.replyTo, null);
  assert.equal(older.html.includes('>Reply<'), false);
  assert.match(older.html, /Review Suggestion|Open in Media Admin/);
  assert.match(older.text, /Submitter Email: None/);
});

test('review API helpers remain JSON-only (legacy token review disabled)', () => {
  const pending = buildMediaSuggestionReviewDto({
    id: 'sug-1',
    name: 'Skyline Sports',
    status: 'pending',
    platformLinks: { website: 'https://example.com' },
    isNational: true,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    coverageLabels: {
      teams: {
        [MONTANA_STATE_ESPN_TEAM_ID]: 'Montana State',
        [MONTANA_ESPN_TEAM_ID]: 'Montana',
      },
      conferences: { 'big-sky': 'Big Sky' },
    },
    notes: 'Great show',
    submitterEmail: 'fan@example.com',
    submittedAt: '2026-08-01T17:00:00.000Z',
  });
  assert.deepEqual(pending.teams, ['Montana State', 'Montana']);
  assert.deepEqual(pending.conferences, ['Big Sky']);
  assert.equal(pending.submitterEmail, 'fan@example.com');

  const pendingGet = buildMediaSuggestionReviewGetSuccess(pending);
  assert.equal(pendingGet.ok, true);
  assert.equal(pendingGet.suggestion.status, 'pending');

  const approvedGet = buildMediaSuggestionReviewGetSuccess(
    buildMediaSuggestionReviewDto({
      id: pending.id,
      name: pending.name,
      status: 'approved',
      platformLinks: pending.platformLinks,
      isNational: pending.isNational,
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      conferenceIds: ['big-sky'],
      coverageLabels: {
        teams: { [MONTANA_STATE_ESPN_TEAM_ID]: 'Montana State' },
        conferences: { 'big-sky': 'Big Sky' },
      },
      notes: pending.notes,
      submitterEmail: pending.submitterEmail,
      submittedAt: pending.submittedAt,
      reviewedAt: '2026-08-02T12:00:00.000Z',
    }),
  );
  assert.equal(approvedGet.suggestion.status, 'approved');
  assert.equal(approvedGet.suggestion.reviewedAt, '2026-08-02T12:00:00.000Z');

  const rejectedGet = buildMediaSuggestionReviewGetSuccess(
    buildMediaSuggestionReviewDto({
      id: pending.id,
      name: pending.name,
      status: 'rejected',
      platformLinks: pending.platformLinks,
      isNational: pending.isNational,
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      conferenceIds: ['big-sky'],
      coverageLabels: {
        teams: { [MONTANA_STATE_ESPN_TEAM_ID]: 'Montana State' },
        conferences: { 'big-sky': 'Big Sky' },
      },
      notes: pending.notes,
      submitterEmail: pending.submitterEmail,
      submittedAt: pending.submittedAt,
      reviewedAt: '2026-08-02T13:00:00.000Z',
    }),
  );
  assert.equal(rejectedGet.suggestion.status, 'rejected');

  const invalid = buildMediaSuggestionReviewGetError('invalid_token');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'invalid_token');
  assert.match(invalid.message, /invalid/i);
  assert.equal(invalid.message.includes('HMAC'), false);
  assert.equal(invalid.message.includes('signature'), false);

  const expired = buildMediaSuggestionReviewGetError('expired_token');
  assert.equal(expired.error, 'expired_token');
  assert.match(expired.message, /expired/i);

  const approveOk = buildMediaSuggestionReviewPostSuccess({
    status: 'approved',
    submitterNotified: true,
  });
  assert.deepEqual(approveOk, {
    ok: true,
    status: 'approved',
    submitterNotified: true,
  });

  const rejectOk = buildMediaSuggestionReviewPostSuccess({
    status: 'rejected',
    submitterNotified: true,
  });
  assert.equal(rejectOk.status, 'rejected');

  const duplicate = buildMediaSuggestionReviewPostError('already_reviewed');
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'already_reviewed');

  assert.equal(isAllowedMediaSuggestionReviewOrigin('https://fcspulse.com'), true);
  assert.equal(isAllowedMediaSuggestionReviewOrigin('http://localhost:4173'), true);
  assert.equal(isAllowedMediaSuggestionReviewOrigin('https://evil.example'), false);
  assert.equal(isAllowedMediaSuggestionReviewOrigin(null), false);
  assert.equal(isAllowedMediaSuggestionReviewOrigin('*'), false);

  const allowedHeaders = buildMediaSuggestionReviewCorsHeaders('https://fcspulse.com');
  assert.equal(allowedHeaders['Access-Control-Allow-Origin'], 'https://fcspulse.com');
  assert.equal(allowedHeaders['Content-Type'], MEDIA_SUGGESTION_REVIEW_JSON_CONTENT_TYPE);
  assert.notEqual(String(allowedHeaders['Access-Control-Allow-Origin'] ?? ''), '*');

  const deniedHeaders = buildMediaSuggestionReviewCorsHeaders('https://evil.example');
  assert.equal(deniedHeaders['Access-Control-Allow-Origin'], undefined);
  assert.equal(deniedHeaders['Content-Type'], MEDIA_SUGGESTION_REVIEW_JSON_CONTENT_TYPE);

  const payloads = [
    pendingGet,
    approvedGet,
    rejectedGet,
    invalid,
    expired,
    approveOk,
    rejectOk,
    duplicate,
  ];
  for (const payload of payloads) {
    const response = createMediaSuggestionReviewJsonResponse(
      payload,
      payload.ok ? 200 : 400,
      'https://fcspulse.com',
    );
    const contentType = response.headers.get('content-type');
    assert.equal(
      isMediaSuggestionReviewJsonContentType(contentType),
      true,
      `expected JSON content-type, got ${contentType}`,
    );
    assert.equal(contentType?.includes('text/html'), false);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://fcspulse.com');
  }

  const rejectedOriginResponse = createMediaSuggestionReviewJsonResponse(
    buildMediaSuggestionReviewGetError('forbidden'),
    403,
    'https://evil.example',
  );
  assert.equal(rejectedOriginResponse.headers.get('access-control-allow-origin'), null);
  assert.equal(
    isMediaSuggestionReviewJsonContentType(rejectedOriginResponse.headers.get('content-type')),
    true,
  );

  const approvedPage = buildMediaSuggestionReviewPageCopy('approved');
  assert.equal(approvedPage.heading, 'Suggestion Approved');
  assert.match(approvedPage.detail, /submitter has been notified/i);

  const rejectedPage = buildMediaSuggestionReviewPageCopy('rejected');
  assert.equal(rejectedPage.heading, 'Suggestion Rejected');

  const already = buildMediaSuggestionReviewPageCopy('already_reviewed');
  assert.match(already.heading, /already reviewed/i);

  const expiredPage = buildMediaSuggestionReviewPageCopy('expired_token');
  assert.match(expiredPage.detail, /expired/i);

  const invalidPage = buildMediaSuggestionReviewPageCopy('invalid_token');
  assert.match(invalidPage.detail, /invalid/i);

  const approvedEmail = formatMediaSuggestionOutcomeEmail({
    outcome: 'approved',
    creatorName: 'Skyline Sports',
  });
  assert.equal(approvedEmail.from, MEDIA_SUGGESTION_OUTCOME_FROM);
  assert.equal(approvedEmail.subject, 'Your FCS Pulse media suggestion was accepted');
  assert.match(approvedEmail.text, /accepted for inclusion/i);
  assert.match(approvedEmail.text, /Skyline Sports/);
  assert.match(approvedEmail.html, /Skyline Sports/);

  const rejectedEmail = formatMediaSuggestionOutcomeEmail({
    outcome: 'rejected',
    creatorName: 'Skyline Sports',
  });
  assert.equal(rejectedEmail.subject, 'Update on your FCS Pulse media suggestion');
  assert.match(rejectedEmail.text, /not to add it at this time/i);
  assert.notEqual(approvedEmail.subject, rejectedEmail.subject);

  // Token review Edge Function is disabled (410) — Media Admin is the active path.
  const reviewFn = readFileSync(
    path.resolve(process.cwd(), 'supabase/functions/review-media-suggestion/index.ts'),
    'utf8',
  );
  assert.match(reviewFn, /410|gone/i);
  assert.match(reviewFn, /admin\.fcspulse\.com/);
  assert.equal(reviewFn.includes('<!DOCTYPE html>'), false);
});

test('media suggestion review tokens: issue, expire, forge, and single-use hash', () => {
  const secret = 'test-review-secret';
  const nonce = createMediaSuggestionReviewNonce();
  const hash = hashMediaSuggestionReviewNonce(nonce);
  assert.equal(hash.length, 64);
  assert.equal(getMediaSuggestionReviewTokenTtlSeconds(), 7 * 24 * 60 * 60);

  const review = issueMediaSuggestionReviewToken({
    secret,
    suggestionId: 'sid-1',
    action: 'review',
    nonce,
    nowMs: 1_700_000_000_000,
  });
  const legacyApprove = issueMediaSuggestionReviewToken({
    secret,
    suggestionId: 'sid-1',
    action: 'approve',
    nonce,
    nowMs: 1_700_000_000_000,
  });
  assert.notEqual(review, legacyApprove);

  const okReview = verifyMediaSuggestionReviewToken({
    secret,
    token: review,
    nowMs: 1_700_000_000_000,
  });
  assert.equal(okReview.ok, true);
  if (okReview.ok) {
    assert.equal(okReview.payload.act, 'review');
    assert.equal(okReview.payload.sid, 'sid-1');
    assert.equal(hashMediaSuggestionReviewNonce(okReview.payload.n), hash);
  }

  const okLegacy = verifyMediaSuggestionReviewToken({
    secret,
    token: legacyApprove,
    nowMs: 1_700_000_000_000,
  });
  assert.equal(okLegacy.ok, true);
  if (okLegacy.ok) {
    assert.equal(okLegacy.payload.act, 'approve');
  }

  const expired = verifyMediaSuggestionReviewToken({
    secret,
    token: review,
    nowMs: 1_700_000_000_000 + 8 * 24 * 60 * 60 * 1000,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, 'expired_token');

  const forged = verifyMediaSuggestionReviewToken({
    secret: 'wrong-secret',
    token: review,
    nowMs: 1_700_000_000_000,
  });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.reason, 'invalid_token');

  const mangled = verifyMediaSuggestionReviewToken({
    secret,
    token: `${review}x`,
    nowMs: 1_700_000_000_000,
  });
  assert.equal(mangled.ok, false);

  // Single-use semantics: after a successful review the stored nonce hash is cleared.
  // A reused token still verifies cryptographically, but DB hash mismatch rejects it.
  const reusedHash = hashMediaSuggestionReviewNonce('different-nonce');
  assert.notEqual(reusedHash, hash);
});

test('legacy Choose Spotify/YouTube/X message is gone from app + edge function source', () => {
  const legacy = 'Choose Spotify, YouTube, or X.';
  assert.equal(isLegacyMediaSuggestionProviderError(legacy), true);

  const roots = [
    path.resolve(process.cwd(), 'src'),
    path.resolve(process.cwd(), 'supabase', 'functions'),
  ];
  const hits: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry)) continue;
      // This test file intentionally mentions the legacy string.
      if (full.replace(/\\/g, '/').endsWith('/runMediaDirectoryTests.ts')) continue;
      const text = readFileSync(full, 'utf8');
      if (text.includes(legacy)) hits.push(path.relative(process.cwd(), full));
    }
  }

  for (const root of roots) walk(root);
  assert.deepEqual(hits, [], `legacy message still present in: ${hits.join(', ')}`);
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

test('team contextual media orders exact team, conference, then national without duplicates', () => {
  const teamExact = baseSource({
    id: 'ctx-team-exact',
    name: 'Zebra Team Show',
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    isNational: false,
    logo_url: 'https://example.com/team.png',
    spotify_url: 'https://open.spotify.com/show/team',
    youtube_url: 'https://youtube.com/@team',
  });
  const teamAndConf = baseSource({
    id: 'ctx-team-and-conf',
    name: 'Alpha Dual Show',
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    isNational: false,
  });
  const conferenceOnly = baseSource({
    id: 'ctx-conf-only',
    name: 'Mid Conference Show',
    conferenceIds: ['big-sky'],
    isNational: false,
  });
  const national = baseSource({
    id: 'ctx-national',
    name: 'National Wide Show',
    isNational: true,
    scope: 'national',
  });
  const otherTeam = baseSource({
    id: 'ctx-other-team',
    name: 'Other Team Only',
    teamIds: [MONTANA_ESPN_TEAM_ID],
    isNational: false,
  });
  const unapproved = baseSource({
    id: 'ctx-unapproved',
    name: 'Pending Creator',
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    is_approved: false,
  });

  const ordered = selectTeamContextualMedia(
    [national, conferenceOnly, otherTeam, unapproved, teamExact, teamAndConf],
    { teamId: MONTANA_STATE_ESPN_TEAM_ID, conferenceId: 'big-sky' },
  );

  assert.deepEqual(
    ordered.map((source) => source.id),
    ['ctx-team-and-conf', 'ctx-team-exact', 'ctx-conf-only', 'ctx-national'],
  );
  assert.equal(new Set(ordered.map((source) => source.id)).size, ordered.length);
  assert.ok(!ordered.some((source) => source.id === 'ctx-other-team'));
  assert.ok(!ordered.some((source) => source.id === 'ctx-unapproved'));

  // Artwork and repeated links preserved on exact match.
  assert.equal(ordered.find((source) => source.id === 'ctx-team-exact')?.logo_url, teamExact.logo_url);
  assert.equal(ordered.find((source) => source.id === 'ctx-team-exact')?.links.length, 2);

  const limited = selectTeamContextualMedia(
    [national, conferenceOnly, teamExact, teamAndConf],
    { teamId: MONTANA_STATE_ESPN_TEAM_ID, conferenceId: 'big-sky', limit: 2 },
  );
  assert.equal(limited.length, 2);
  assert.deepEqual(
    limited.map((source) => source.id),
    ['ctx-team-and-conf', 'ctx-team-exact'],
  );
});

test('team contextual media empty when no relevant creators', () => {
  const sources = [
    baseSource({
      id: 'ctx-empty-other',
      name: 'Other',
      teamIds: [MONTANA_ESPN_TEAM_ID],
      isNational: false,
    }),
  ];
  assert.deepEqual(
    selectTeamContextualMedia(sources, {
      teamId: MONTANA_STATE_ESPN_TEAM_ID,
      conferenceId: 'mvfc',
    }),
    [],
  );
});

test('conference contextual media requires explicit conference coverage', () => {
  const conferenceTagged = baseSource({
    id: 'conf-tagged',
    name: 'Big Sky Radio',
    conferenceIds: ['big-sky'],
    isNational: false,
  });
  const conferenceAndNational = baseSource({
    id: 'conf-and-national',
    name: 'Big Sky + National',
    conferenceIds: ['big-sky'],
    isNational: true,
  });
  const teamOnlyInConference = baseSource({
    id: 'conf-team-only',
    name: 'Bobcat Only Pod',
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    isNational: false,
  });
  const national = baseSource({
    id: 'conf-national',
    name: 'National FCS Hour',
    isNational: true,
    scope: 'national',
  });
  const otherConference = baseSource({
    id: 'conf-other',
    name: 'MVFC Weekly',
    conferenceIds: ['mvfc'],
    isNational: false,
  });

  const ordered = selectConferenceContextualMedia(
    [national, teamOnlyInConference, otherConference, conferenceAndNational, conferenceTagged],
    { conferenceId: 'big-sky' },
  );

  assert.deepEqual(
    ordered.map((source) => source.id),
    ['conf-and-national', 'conf-tagged'],
  );
  assert.ok(!ordered.some((source) => source.id === 'conf-national'));
  assert.ok(!ordered.some((source) => source.id === 'conf-team-only'));
  assert.ok(!ordered.some((source) => source.id === 'conf-other'));

  assert.deepEqual(selectConferenceContextualMedia([], { conferenceId: 'big-sky' }), []);
  assert.deepEqual(
    selectConferenceContextualMedia([conferenceTagged], { conferenceId: 'not-a-conference' }),
    [],
  );
});

test('suggest media route helpers validate IDs and preselect coverage without National', () => {
  const teamHref = buildSuggestMediaHref({
    teamId: MONTANA_STATE_ESPN_TEAM_ID,
    teamName: 'Montana State',
    conferenceId: 'big-sky',
    conferenceName: 'Big Sky',
  });
  assert.deepEqual(teamHref, {
    pathname: '/suggest-fcs-media',
    params: {
      teamId: MONTANA_STATE_ESPN_TEAM_ID,
      teamName: 'Montana State',
      conferenceId: 'big-sky',
      conferenceName: 'Big Sky',
    },
  });

  const badHref = buildSuggestMediaHref({
    teamId: 'not-numeric',
    conferenceId: 'fake-conf',
  });
  assert.equal(badHref, '/suggest-fcs-media');

  const teamCoverage = resolveSuggestCoverageFromParams({
    teamId: MONTANA_STATE_ESPN_TEAM_ID,
    teamName: 'Montana State',
    conferenceId: 'big-sky',
    conferenceName: 'Big Sky',
  });
  assert.equal(teamCoverage.national, false);
  assert.deepEqual(
    teamCoverage.teams.map((team) => team.id),
    [MONTANA_STATE_ESPN_TEAM_ID],
  );
  assert.deepEqual(
    teamCoverage.conferences.map((conference) => conference.id),
    ['big-sky'],
  );

  const chips = getMediaBrowseChips(teamCoverage);
  assert.ok(chips.some((chip) => chip.kind === 'team'));
  assert.ok(chips.some((chip) => chip.kind === 'conference'));
  assert.ok(!chips.some((chip) => chip.kind === 'national'));

  const afterRemoveTeam = removeMediaBrowseChip(teamCoverage, chips.find((chip) => chip.kind === 'team')!);
  assert.equal(afterRemoveTeam.teams.length, 0);
  assert.equal(afterRemoveTeam.conferences.length, 1);

  const conferenceCoverage = resolveSuggestCoverageFromParams({
    conferenceId: 'big-sky',
    conferenceName: 'Big Sky',
  });
  assert.equal(conferenceCoverage.national, false);
  assert.equal(conferenceCoverage.teams.length, 0);
  assert.deepEqual(
    conferenceCoverage.conferences.map((conference) => conference.id),
    ['big-sky'],
  );

  const ignored = resolveSuggestCoverageFromParams({
    teamId: 'abc',
    conferenceId: 'nope',
  });
  assert.deepEqual(ignored, createEmptyMediaBrowseFilter());
});

test('view all media hrefs open Discover with the correct active filter', () => {
  resetDiscoverMediaHandoffForTests();

  const teamHref = buildDiscoverTeamMediaHref(MONTANA_STATE_ESPN_TEAM_ID, 'Montana State');
  assert.deepEqual(teamHref, {
    pathname: '/(tabs)/news',
    params: {
      section: 'media',
      teamId: MONTANA_STATE_ESPN_TEAM_ID,
      teamName: 'Montana State',
    },
  });

  const preparedTeam = prepareDiscoverTeamMediaNavigation(
    MONTANA_STATE_ESPN_TEAM_ID,
    'Montana State',
  );
  assert.deepEqual(preparedTeam, teamHref);
  const teamHandoff = takeDiscoverMediaHandoff();
  assert.ok(teamHandoff);
  const teamSeed = buildDiscoverMediaBrowseSeed(teamHandoff!);
  assert.equal(teamSeed.filter.national, false);
  assert.deepEqual(
    teamSeed.filter.teams.map((team) => team.id),
    [MONTANA_STATE_ESPN_TEAM_ID],
  );
  assert.equal(teamSeed.filter.conferences.length, 0);
  assert.ok(getMediaBrowseChips(teamSeed.filter).some((chip) => chip.kind === 'team'));

  const badTeamHref = buildDiscoverTeamMediaHref('slug-team', 'Slug');
  assert.deepEqual(badTeamHref, {
    pathname: '/(tabs)/news',
    params: { section: 'media' },
  });

  const conferenceHref = buildDiscoverConferenceMediaHref('big-sky', 'Big Sky');
  assert.deepEqual(conferenceHref, {
    pathname: '/(tabs)/news',
    params: {
      section: 'media',
      conferenceId: 'big-sky',
      conferenceName: 'Big Sky',
    },
  });

  const preparedConference = prepareDiscoverConferenceMediaNavigation('big-sky', 'Big Sky');
  assert.deepEqual(preparedConference, conferenceHref);
  const conferenceHandoff = takeDiscoverMediaHandoff();
  assert.ok(conferenceHandoff);
  const conferenceSeed = buildDiscoverMediaBrowseSeed(conferenceHandoff!);
  assert.equal(conferenceSeed.filter.national, false);
  assert.deepEqual(
    conferenceSeed.filter.conferences.map((conference) => conference.id),
    ['big-sky'],
  );
  assert.equal(conferenceSeed.filter.teams.length, 0);
  assert.ok(getMediaBrowseChips(conferenceSeed.filter).some((chip) => chip.kind === 'conference'));

  const browse = buildConferenceBrowseFilter('big-sky', 'Big Sky');
  assert.equal(browse.national, false);
  assert.deepEqual(
    browse.conferences.map((conference) => conference.id),
    ['big-sky'],
  );

  const teamBrowse = buildTeamBrowseFilter(MONTANA_STATE_ESPN_TEAM_ID, 'Montana State');
  assert.equal(teamBrowse.national, false);
  assert.deepEqual(
    teamBrowse.teams.map((team) => team.id),
    [MONTANA_STATE_ESPN_TEAM_ID],
  );

  const badConferenceHref = buildDiscoverConferenceMediaHref('not-real', 'Nope');
  assert.deepEqual(badConferenceHref, {
    pathname: '/(tabs)/news',
    params: { section: 'media' },
  });
});

test('discover media route filter applies once and ignores invalid IDs', () => {
  resetDiscoverMediaHandoffForTests();

  const first = queueDiscoverMediaHandoff({
    teamId: MONTANA_STATE_ESPN_TEAM_ID,
    teamName: 'Montana State',
  });
  const takenOnce = takeDiscoverMediaHandoff();
  assert.equal(takenOnce?.id, first.id);
  assert.equal(takeDiscoverMediaHandoff(), null);

  const second = queueDiscoverMediaHandoff({
    teamId: MONTANA_STATE_ESPN_TEAM_ID,
    teamName: 'Montana State',
  });
  assert.notEqual(second.id, first.id);
  assert.equal(takeDiscoverMediaHandoff()?.id, second.id);
  assert.equal(takeDiscoverMediaHandoff(), null);

  assert.equal(
    resolveDiscoverMediaHandoffFromParams({
      teamId: 'not-a-team',
      conferenceId: 'nope',
    }),
    null,
  );

  const valid = resolveDiscoverMediaHandoffFromParams({
    conferenceId: 'big-sky',
    conferenceName: 'Big Sky',
  });
  assert.deepEqual(valid, {
    teamId: null,
    teamName: null,
    conferenceId: 'big-sky',
    conferenceName: 'Big Sky',
  });

  const filter = buildDiscoverBrowseFilterFromHandoff(valid!);
  assert.equal(filter.national, false);
  assert.deepEqual(
    filter.conferences.map((conference) => conference.id),
    ['big-sky'],
  );
});

test('contextual preview limit, artwork initials fallback, and suggest a11y label', () => {
  assert.equal(CONTEXTUAL_MEDIA_INLINE_LIMIT, 4);
  assert.equal(SUGGEST_MEDIA_A11Y_LABEL, 'Suggest media');
  assert.equal(getMediaCreatorInitials('Bobcat Insider Podcast'), 'BI');
  assert.equal(getMediaCreatorInitials('Mondak'), 'MO');
  assert.equal(getMediaCreatorInitials(''), '?');

  const sources = [
    baseSource({ id: 'p1', name: 'A', teamIds: [MONTANA_STATE_ESPN_TEAM_ID] }),
    baseSource({ id: 'p2', name: 'B', teamIds: [MONTANA_STATE_ESPN_TEAM_ID] }),
    baseSource({ id: 'p3', name: 'C', teamIds: [MONTANA_STATE_ESPN_TEAM_ID] }),
    baseSource({ id: 'p4', name: 'D', teamIds: [MONTANA_STATE_ESPN_TEAM_ID] }),
    baseSource({ id: 'p5', name: 'E', teamIds: [MONTANA_STATE_ESPN_TEAM_ID] }),
  ];
  const limited = selectTeamContextualMedia(sources, {
    teamId: MONTANA_STATE_ESPN_TEAM_ID,
    limit: CONTEXTUAL_MEDIA_INLINE_LIMIT,
  });
  assert.equal(limited.length, CONTEXTUAL_MEDIA_INLINE_LIMIT);

  const teamPage = readFileSync(path.join(process.cwd(), 'src/app/team/[teamId].tsx'), 'utf8');
  const teamMediaIndex = teamPage.indexOf('<TeamMediaSection');
  const scheduleIndex = teamPage.indexOf('Season schedule & results');
  assert.ok(teamMediaIndex > 0);
  assert.ok(scheduleIndex > 0);
  assert.ok(teamMediaIndex < scheduleIndex, 'team media should render above schedule');

  const conferencePage = readFileSync(
    path.join(process.cwd(), 'src/app/(tabs)/schedule.tsx'),
    'utf8',
  );
  const confMediaIndex = conferencePage.indexOf('<ConferenceMediaSection');
  const confScheduleIndex = conferencePage.indexOf('<ConferenceScheduleSection');
  assert.ok(confMediaIndex > 0);
  assert.ok(confScheduleIndex > 0);
  assert.ok(
    confMediaIndex < confScheduleIndex,
    'conference media should render above schedule content',
  );

  const preview = readFileSync(
    path.join(process.cwd(), 'src/components/media/ContextualMediaPreview.tsx'),
    'utf8',
  );
  assert.match(preview, /accessibilityLabel=\{SUGGEST_MEDIA_A11Y_LABEL\}/);
  assert.match(preview, /No media listed for this team yet\.|emptyMessage/);
});

console.log('\nAll media directory tests passed.');
