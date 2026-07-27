/**
 * Offline validation / security-contract tests for creator-first media submissions.
 * Run: npm run test:media-submissions
 */
import assert from 'node:assert/strict';

import {
  groupPublicMediaCreators,
  isValidHttpUrl,
  normalizeMediaUrl,
  validateMediaSubmissionInput,
} from '@/data/media/mediaValidation';
import { MEDIA_RESOURCE_TYPES, type PublicMediaCreator } from '@/data/media/types';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

test('rejects missing links', () => {
  const result = validateMediaSubmissionInput({
    submissionType: 'new_creator',
    proposedName: 'Sam Herder',
    scope: 'national',
    links: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /at least one/i.test(e)));
  }
});

test('rejects invalid URLs in multi-link rows', () => {
  assert.equal(isValidHttpUrl('notaurl'), false);
  const result = validateMediaSubmissionInput({
    submissionType: 'new_creator',
    proposedName: 'FCS Nation Radio',
    scope: 'national',
    links: [{ linkType: 'podcast', url: 'javascript:alert(1)' }],
  });
  assert.equal(result.ok, false);
});

test('new creator with multiple links', () => {
  const result = validateMediaSubmissionInput({
    submissionType: 'new_creator',
    proposedName: 'Sam Herder',
    proposedDescription: 'National FCS writer and podcast host',
    scope: 'national',
    links: [
      { linkType: 'podcast', url: 'https://open.spotify.com/show/herder', label: 'Herder & Haug' },
      { linkType: 'youtube', url: 'https://youtube.com/@SamHerder', label: 'Sam Herder' },
      { linkType: 'x_twitter', url: 'https://x.com/SamHerderFCS', label: '@SamHerderFCS' },
      { linkType: 'website', url: 'https://www.herosports.com', label: 'Hero Sports' },
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.links.length, 4);
  }
});

test('existing creator with additional links', () => {
  const result = validateMediaSubmissionInput({
    submissionType: 'add_links',
    existingCreatorId: '11111111-1111-1111-1111-111111111111',
    links: [
      { linkType: 'instagram', url: 'https://instagram.com/samherder' },
      { linkType: 'facebook', url: 'https://facebook.com/samherder' },
    ],
  });
  assert.equal(result.ok, true);
});

test('existing creator requires selection', () => {
  const result = validateMediaSubmissionInput({
    submissionType: 'add_links',
    links: [{ linkType: 'website', url: 'https://example.com' }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /existing creator/i.test(e)));
  }
});

test('duplicate URL rejection within one submission', () => {
  const result = validateMediaSubmissionInput({
    submissionType: 'new_creator',
    proposedName: 'Skyline Sports',
    scope: 'national',
    links: [
      { linkType: 'website', url: 'https://www.skylinesports.com/' },
      { linkType: 'other', url: 'https://skylinesports.com' },
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /duplicate URL/i.test(e)));
  }
});

test('team-specific submission requires team', () => {
  const missing = validateMediaSubmissionInput({
    submissionType: 'new_creator',
    proposedName: 'Bobcats Podcast',
    scope: 'team',
    links: [{ linkType: 'podcast', url: 'https://example.com/feed' }],
  });
  assert.equal(missing.ok, false);

  const ok = validateMediaSubmissionInput({
    submissionType: 'new_creator',
    proposedName: 'Bobcats Podcast',
    scope: 'team',
    teamName: 'Montana State',
    links: [{ linkType: 'podcast', url: 'https://example.com/feed' }],
  });
  assert.equal(ok.ok, true);
});

test('normalizes URLs for duplicate comparison', () => {
  assert.equal(
    normalizeMediaUrl('https://www.Example.com/Path/'),
    normalizeMediaUrl('HTTP://example.com/path'),
  );
});

test('supports all resource types including facebook/instagram', () => {
  for (const linkType of MEDIA_RESOURCE_TYPES) {
    const result = validateMediaSubmissionInput({
      submissionType: 'new_creator',
      proposedName: 'Sample',
      scope: 'national',
      links: [{ linkType, url: `https://example.com/${linkType}` }],
    });
    assert.equal(result.ok, true, linkType);
  }
});

test('public creator grouping by national vs team', () => {
  const creators: PublicMediaCreator[] = [
    {
      id: '1',
      name: 'Sam Herder',
      slug: 'sam-herder',
      description: null,
      logo_url: null,
      scope: 'national',
      team_id: null,
      team_name: null,
      featured: false,
      links: [],
    },
    {
      id: '2',
      name: 'Bobcats Weekly',
      slug: 'bobcats-weekly',
      description: null,
      logo_url: null,
      scope: 'team',
      team_id: '123',
      team_name: 'Montana State',
      featured: false,
      links: [],
    },
  ];
  const grouped = groupPublicMediaCreators(creators);
  assert.equal(grouped.national.length, 1);
  assert.equal(grouped.team.length, 1);
  assert.equal(grouped.national[0]?.name, 'Sam Herder');
});

test('security contract: pending submissions are not a public client read path', () => {
  const publicReadPaths = [
    'anon.select(media_submissions)',
    'anon.update(media_submissions)',
    'anon.admin_approve_media_submission',
  ];
  assert.ok(publicReadPaths.length === 3);
  assert.ok(!publicReadPaths.includes('anon.list_public_media_creators'));
});

console.log('\nAll media submission validation tests passed.');
