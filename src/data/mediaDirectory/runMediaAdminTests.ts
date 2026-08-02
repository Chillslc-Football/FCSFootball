/**
 * Offline tests for authenticated Media Admin helpers.
 * Run: npm run test:media-admin
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  mediaAdminNameSimilarity,
  normalizeMediaAdminUrlKey,
  rankMediaAdminDuplicates,
  summarizeMediaAdminMerge,
} from '@/data/mediaDirectory/mediaAdminDuplicates';
import {
  buildMediaAdminAuditSummary,
  decideMediaAdminPublish,
  filterMediaAdminSources,
  filterMediaAdminSuggestionQueue,
  mediaAdminUnauthorizedMessage,
  MEDIA_CORRECTION_TYPES,
  resolveMediaAdminAuthAccess,
  validateMediaAdminSuggestionDraft,
} from '@/data/mediaDirectory/mediaAdminLogic';
import {
  mediaLinkRowsToRpcJson,
  reorderMediaLinkRows,
  validateMediaLinkRows,
} from '@/data/mediaDirectory/mediaLinkRows';
import {
  buildMediaAdminSuggestionUrl,
  MEDIA_ADMIN_SITE_ORIGIN,
} from '@/data/mediaDirectory/mediaAdminUrls';
import {
  formatMediaSuggestionOwnerEmail,
  buildMediaSuggestionReplyMailto,
} from '@/data/mediaDirectory/mediaSuggestionNotifyEmail';
import {
  MEDIA_SUGGESTION_OUTCOME_FROM,
  formatMediaSuggestionOutcomeEmail,
} from '@/data/mediaDirectory/mediaSuggestionOutcomeEmail';
import { MONTANA_STATE_ESPN_TEAM_ID } from '@/data/mediaDirectory/types';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

test('allowed admin login gate vs unauthorized user blocked', () => {
  assert.deepEqual(
    resolveMediaAdminAuthAccess({
      configured: true,
      hasSession: true,
      isAllowlistedAdmin: true,
    }),
    { ok: true, email: 'admin' },
  );

  const unauthorized = resolveMediaAdminAuthAccess({
    configured: true,
    hasSession: true,
    isAllowlistedAdmin: false,
  });
  assert.equal(unauthorized.ok, false);
  if (!unauthorized.ok) assert.equal(unauthorized.reason, 'unauthorized');
  assert.match(mediaAdminUnauthorizedMessage(), /not authorized/i);

  const signedOut = resolveMediaAdminAuthAccess({
    configured: true,
    hasSession: false,
    isAllowlistedAdmin: false,
  });
  assert.equal(signedOut.ok, false);
  if (!signedOut.ok) assert.equal(signedOut.reason, 'signed_out');
});

test('pending queue load filters by status and search', () => {
  const rows = [
    {
      name: 'Skyline Sports',
      submitterEmail: 'fan@example.com',
      notesPreview: 'Great show',
      status: 'pending',
    },
    {
      name: 'Other Show',
      submitterEmail: 'other@example.com',
      notesPreview: '',
      status: 'approved',
    },
  ];
  assert.equal(filterMediaAdminSuggestionQueue(rows, { status: 'pending' }).length, 1);
  assert.equal(
    filterMediaAdminSuggestionQueue(rows, { status: null, search: 'skyline' })[0]?.name,
    'Skyline Sports',
  );
});

test('edit suggestion draft validation', () => {
  const bad = validateMediaAdminSuggestionDraft({
    name: '',
    links: [],
    platformLinks: {},
    isNational: false,
    teamIds: [],
    conferenceIds: [],
  });
  assert.equal(bad.ok, false);

  const ok = validateMediaAdminSuggestionDraft({
    name: 'Skyline Sports',
    description: 'FCS coverage',
    logoUrl: 'https://example.com/logo.png',
    links: [
      {
        platform: 'website',
        label: null,
        url: 'https://example.com',
        sortOrder: 0,
      },
      {
        platform: 'youtube',
        label: 'Main',
        url: 'https://youtube.com/@x',
        sortOrder: 1,
      },
    ],
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    notes: 'Looks good',
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.platformLinks.website, 'https://example.com');
    assert.equal(ok.value.links.length, 2);
    assert.deepEqual(ok.value.teamIds, [MONTANA_STATE_ESPN_TEAM_ID]);
  }
});

test('approve and publish + duplicate publish prevention', () => {
  const draft = {
    name: 'Skyline Sports',
    links: [
      {
        platform: 'website' as const,
        label: null,
        url: 'https://example.com',
        sortOrder: 0,
      },
    ],
    platformLinks: { website: 'https://example.com' },
    isNational: true,
    teamIds: [] as string[],
    conferenceIds: [] as string[],
  };

  const create = decideMediaAdminPublish({
    isAdmin: true,
    suggestionStatus: 'pending',
    publishedMediaSourceId: null,
    draft,
  });
  assert.equal(create.ok, true);
  if (create.ok) assert.equal(create.mode, 'create');

  const duplicate = decideMediaAdminPublish({
    isAdmin: true,
    suggestionStatus: 'approved',
    publishedMediaSourceId: 'source-1',
    draft,
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.reason, 'already_published');

  const needsConfirm = decideMediaAdminPublish({
    isAdmin: true,
    suggestionStatus: 'pending',
    publishedMediaSourceId: null,
    draft,
    nameMatches: [{ id: 'source-1', name: 'Skyline Sports' }],
  });
  assert.equal(needsConfirm.ok, false);
  if (!needsConfirm.ok) assert.equal(needsConfirm.reason, 'overwrite_confirmation_required');

  const overwrite = decideMediaAdminPublish({
    isAdmin: true,
    suggestionStatus: 'pending',
    publishedMediaSourceId: null,
    draft,
    existingSourceId: 'source-1',
    confirmOverwrite: true,
  });
  assert.equal(overwrite.ok, true);
  if (overwrite.ok) assert.equal(overwrite.mode, 'update');
});

test('reject path and outcome emails', () => {
  const rejected = decideMediaAdminPublish({
    isAdmin: true,
    suggestionStatus: 'rejected',
    publishedMediaSourceId: null,
    draft: {
      name: 'X',
      links: [
        {
          platform: 'website',
          label: null,
          url: 'https://example.com',
          sortOrder: 0,
        },
      ],
      platformLinks: { website: 'https://example.com' },
      isNational: true,
      teamIds: [],
      conferenceIds: [],
    },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.reason, 'already_reviewed');

  const approvedEmail = formatMediaSuggestionOutcomeEmail({
    outcome: 'approved',
    creatorName: 'Skyline Sports',
  });
  assert.equal(approvedEmail.from, MEDIA_SUGGESTION_OUTCOME_FROM);
  assert.equal(approvedEmail.subject, 'Your FCS Pulse media suggestion was accepted');

  const rejectedEmail = formatMediaSuggestionOutcomeEmail({
    outcome: 'rejected',
    creatorName: 'Skyline Sports',
  });
  assert.equal(rejectedEmail.subject, 'Update on your FCS Pulse media suggestion');
});

test('edit existing creator filters + hidden creator', () => {
  const rows = [
    {
      name: 'Active National',
      isNational: true,
      isActive: true,
      teamIds: [] as string[],
      conferenceIds: [] as string[],
    },
    {
      name: 'Hidden Team Show',
      isNational: false,
      isActive: false,
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      conferenceIds: ['big-sky'],
    },
  ];
  assert.equal(filterMediaAdminSources(rows, { active: true }).length, 1);
  assert.equal(filterMediaAdminSources(rows, { active: false })[0]?.name, 'Hidden Team Show');
  assert.equal(
    filterMediaAdminSources(rows, { teamId: MONTANA_STATE_ESPN_TEAM_ID, conferenceId: 'big-sky' })
      .length,
    1,
  );
});

test('team/conference/platform change audit record', () => {
  const audit = buildMediaAdminAuditSummary({
    action: 'source_updated',
    entityType: 'source',
    entityId: 'src-1',
    adminEmail: 'admin@example.com',
    changedFields: {
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      conferenceIds: ['big-sky'],
      platformLinks: { website: 'https://example.com', youtube: 'https://youtube.com/@x' },
      isActive: false,
    },
  });
  assert.equal(audit.entityType, 'source');
  assert.match(audit.summary, /teamIds/);
  assert.equal(audit.changedFields.isActive, false);
  assert.deepEqual(MEDIA_CORRECTION_TYPES, [
    'wrong_tag',
    'broken_link',
    'updated_artwork',
    'incorrect_description',
    'inactive_creator',
    'other',
  ]);
});

test('owner notification links to admin suggestion page', () => {
  const adminUrl = buildMediaAdminSuggestionUrl({ suggestionId: 'abc-123' });
  assert.equal(adminUrl, `${MEDIA_ADMIN_SITE_ORIGIN}/suggestions/abc-123`);

  const email = formatMediaSuggestionOwnerEmail({
    id: 'abc-123',
    name: 'Skyline Sports',
    platformLinks: { website: 'https://example.com' },
    isNational: true,
    teamIds: [],
    conferenceIds: [],
    notes: null,
    submitterEmail: 'fan@example.com',
    status: 'pending',
    submittedAt: '2026-08-01T17:00:00.000Z',
    reviewUrl: adminUrl,
  });
  assert.match(email.html, /admin\.fcspulse\.com\/suggestions\/abc-123/);
  assert.match(email.html, /Open in Media Admin/);
  assert.equal(email.html.includes('/review?token='), false);
  assert.equal(email.html.includes('/functions/v1/review-media-suggestion'), false);

  const mailto = buildMediaSuggestionReplyMailto({
    submitterEmail: 'fan@example.com',
    creatorName: 'Skyline Sports',
  });
  assert.match(mailto, /^mailto:/);
});

test('repeatable links: duplicates blocked, reorder, approval copy semantics', () => {
  const twoYoutube = validateMediaLinkRows([
    { platform: 'youtube', label: 'Main Channel', url: 'https://youtube.com/@main' },
    { platform: 'youtube', label: 'Podcast', url: 'https://youtube.com/@podcast' },
    { platform: 'spotify', label: 'Weekly Show', url: 'https://open.spotify.com/show/1' },
    { platform: 'spotify', label: '', url: 'https://open.spotify.com/show/2' },
    { platform: 'website', label: '', url: '' },
  ]);
  assert.equal(twoYoutube.ok, true);
  if (twoYoutube.ok) {
    assert.equal(twoYoutube.value.length, 4);
    assert.equal(twoYoutube.value.filter((l) => l.platform === 'youtube').length, 2);
    assert.equal(twoYoutube.value.filter((l) => l.platform === 'spotify').length, 2);
  }

  const dup = validateMediaLinkRows([
    { platform: 'youtube', label: 'A', url: 'https://youtube.com/@same/' },
    { platform: 'youtube', label: 'B', url: 'https://youtube.com/@same' },
  ]);
  assert.equal(dup.ok, false);

  const one = validateMediaLinkRows([
    { platform: 'website', label: '', url: '' },
    { platform: 'spotify', label: 'Show', url: 'https://open.spotify.com/show/abc' },
  ]);
  assert.equal(one.ok, true);
  if (one.ok) assert.equal(one.value.length, 1);

  if (twoYoutube.ok) {
    const reordered = reorderMediaLinkRows(twoYoutube.value, 0, 2);
    assert.equal(reordered[0]?.url, 'https://youtube.com/@podcast');
    assert.equal(reordered[2]?.url, 'https://youtube.com/@main');
    const rpc = mediaLinkRowsToRpcJson(reordered);
    assert.equal(rpc[0]?.sort_order, 0);
    assert.equal(rpc.length, 4);
  }

  const audit = buildMediaAdminAuditSummary({
    action: 'suggestion_approved_published',
    entityType: 'suggestion',
    entityId: 'sug-1',
    adminEmail: 'admin@example.com',
    changedFields: { linkCount: 4, mode: 'create' },
  });
  assert.match(audit.summary, /linkCount/);
});

test('migration and review-site deprecation markers exist', () => {
  const migration = readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20260801180000_media_admin_directory.sql'),
    'utf8',
  );
  assert.match(migration, /admin_approve_and_publish_media_suggestion/);
  assert.match(migration, /media_admin_audit_log/);
  assert.match(migration, /media_correction_suggestions/);
  assert.match(migration, /already_published/);
  assert.match(migration, /is_active/);

  const linksMigration = readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20260801190000_media_repeatable_links.sql'),
    'utf8',
  );
  assert.match(linksMigration, /media_source_links/);
  assert.match(linksMigration, /media_suggestion_links/);
  assert.match(linksMigration, /admin_apply_media_correction/);
  assert.match(linksMigration, /p_links/);

  const detailMigration = readFileSync(
    path.resolve(
      process.cwd(),
      'supabase/migrations/20260802120000_media_admin_suggestion_detail.sql',
    ),
    'utf8',
  );
  assert.match(detailMigration, /p_admin_notes/);
  assert.match(detailMigration, /admin_find_media_source_matches/);
  assert.match(detailMigration, /admin_merge_media_suggestion/);
  assert.match(detailMigration, /p_copy_links/);
  assert.match(detailMigration, /Preserve original submitter notes/);

  const logosMigration = readFileSync(
    path.resolve(
      process.cwd(),
      'supabase/migrations/20260802140000_restore_media_source_logos.sql',
    ),
    'utf8',
  );
  assert.match(logosMigration, /restore_media_source_logos|Restore verified media_sources\.logo_url/i);
  assert.match(logosMigration, /logo_url = coalesce\(v_logo, logo_url\)/);
  assert.match(logosMigration, /FCS Fans Nation Podcast/);
  assert.match(logosMigration, /Skyline Sports/);

  const deprecated = readFileSync(
    path.resolve(process.cwd(), 'review-site/DEPRECATED.md'),
    'utf8',
  );
  assert.match(deprecated, /admin\.fcspulse\.com/);
});

test('Cloudflare Pages SPA fallback _redirects is configured', () => {
  const redirects = readFileSync(
    path.resolve(process.cwd(), 'admin-site/public/_redirects'),
    'utf8',
  ).trim();
  assert.match(redirects, /^\/\*+\s+\/index\.html\s+200$/m);

  const viteConfig = readFileSync(
    path.resolve(process.cwd(), 'admin-site/vite.config.ts'),
    'utf8',
  );
  assert.match(viteConfig, /base:\s*['"]\/['"]/);
  assert.match(viteConfig, /publicDir:\s*['"]public['"]/);

  const pkg = readFileSync(path.resolve(process.cwd(), 'admin-site/package.json'), 'utf8');
  assert.match(pkg, /verify-spa-redirects\.mjs/);

  const main = readFileSync(path.resolve(process.cwd(), 'admin-site/src/main.tsx'), 'utf8');
  assert.match(main, /BrowserRouter/);
  const app = readFileSync(path.resolve(process.cwd(), 'admin-site/src/App.tsx'), 'utf8');
  assert.match(app, /path="\/suggestions\/:id"/);
  assert.match(app, /path="\/sources\/:id"/);
  assert.match(app, /path="\/reports\/:id"/);
});

test('pending row route opens suggestion detail workspace', () => {
  const suggestionsPage = readFileSync(
    path.resolve(process.cwd(), 'admin-site/src/pages/SuggestionsPage.tsx'),
    'utf8',
  );
  const detailPage = readFileSync(
    path.resolve(process.cwd(), 'admin-site/src/pages/SuggestionDetailPage.tsx'),
    'utf8',
  );
  const app = readFileSync(path.resolve(process.cwd(), 'admin-site/src/App.tsx'), 'utf8');

  assert.match(app, /path="\/suggestions\/:id"/);
  assert.match(suggestionsPage, /to=\{`\/suggestions\/\$\{row\.id\}`\}/);
  assert.match(detailPage, /Back to Pending/);
  assert.match(detailPage, /Possible Duplicates/);
  assert.match(detailPage, /Public Preview/);
  assert.match(detailPage, /Save Draft Changes/);
  assert.match(detailPage, /Approve and Publish/);
  assert.match(detailPage, /Confirm Merge/);
  assert.match(detailPage, /Confirm Reject/);
  assert.match(detailPage, /Private Admin Notes/);
  assert.match(detailPage, /notes: null/);
  assert.match(detailPage, /mergeSuggestion/);
  assert.match(detailPage, /CreatorCardPreview/);
  assert.match(detailPage, /modal-backdrop/);
  assert.match(detailPage, /detail-layout/);
});

test('duplicate candidates: name, URL overlap, similarity ranking', () => {
  assert.equal(normalizeMediaAdminUrlKey('https://youtube.com/@x/'), 'https://youtube.com/@x');
  assert.ok(mediaAdminNameSimilarity('Skyline Sports', 'Skyline Sport') > 0.7);

  const ranked = rankMediaAdminDuplicates({
    suggestionName: 'Skyline Sports Network',
    suggestionUrls: ['https://youtube.com/@skyline', 'https://example.com/show'],
    candidates: [
      {
        id: 'exact',
        name: 'Skyline Sports Network',
        urls: ['https://other.example'],
        isNational: true,
        teamIds: [],
        conferenceIds: [],
      },
      {
        id: 'url',
        name: 'Different Show',
        urls: ['https://youtube.com/@skyline/'],
        isNational: false,
        teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
        conferenceIds: ['big-sky'],
      },
      {
        id: 'similar',
        name: 'Skyline Sport',
        urls: [],
        isNational: false,
        teamIds: [],
        conferenceIds: [],
      },
      {
        id: 'noise',
        name: 'Totally Unrelated',
        urls: ['https://unrelated.example'],
      },
    ],
    limit: 5,
  });

  assert.equal(ranked.length, 3);
  assert.equal(ranked[0]?.id, 'exact');
  assert.ok(ranked.some((item) => item.id === 'url' && item.reasons.includes('url_overlap')));
  assert.ok(ranked.every((item) => item.matchLabel));
  assert.equal(
    ranked.find((item) => item.id === 'noise'),
    undefined,
  );
});

test('merge preview copies only selected fields and skips duplicate URLs', () => {
  const summary = summarizeMediaAdminMerge({
    selection: {
      copyLinks: true,
      copyArtwork: true,
      copyDescription: false,
      copyTeams: true,
      copyConferences: false,
      copyNational: true,
    },
    existing: {
      name: 'Existing Show',
      description: 'Keep me',
      logoUrl: null,
      isNational: false,
      teamIds: ['147'],
      conferenceIds: ['big-sky'],
      urls: ['https://youtube.com/@same'],
    },
    suggestion: {
      description: 'New description ignored',
      logoUrl: 'https://example.com/art.png',
      isNational: true,
      teamIds: ['149'],
      conferenceIds: ['mvfc'],
      urls: ['https://youtube.com/@same/', 'https://open.spotify.com/show/new'],
    },
  });

  assert.equal(summary.newLinkCount, 1);
  assert.equal(summary.willReplaceArtwork, true);
  assert.equal(summary.willReplaceDescription, false);
  assert.ok(summary.lines.some((line) => /Add 1 new link/i.test(line)));
  assert.ok(summary.lines.some((line) => /artwork/i.test(line)));
  assert.ok(summary.lines.some((line) => /team coverage/i.test(line)));
  assert.equal(
    summary.lines.some((line) => /description/i.test(line)),
    false,
  );
});

test('draft save preserves submitter notes and tracks admin notes in audit', () => {
  const detailPage = readFileSync(
    path.resolve(process.cwd(), 'admin-site/src/pages/SuggestionDetailPage.tsx'),
    'utf8',
  );
  assert.match(detailPage, /notes: null/);
  assert.match(detailPage, /adminNotes:/);

  const audit = buildMediaAdminAuditSummary({
    action: 'suggestion_draft_saved',
    entityType: 'suggestion',
    entityId: 'sug-1',
    adminEmail: 'admin@example.com',
    changedFields: {
      name: 'Skyline Sports',
      linkCount: 2,
      adminNotesUpdated: true,
      teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
      conferenceIds: ['big-sky'],
    },
  });
  assert.match(audit.summary, /adminNotesUpdated/);
  assert.equal(audit.changedFields.adminNotesUpdated, true);
});

test('unauthorized access blocked for media admin', () => {
  const result = resolveMediaAdminAuthAccess({
    configured: true,
    hasSession: true,
    isAllowlistedAdmin: false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'unauthorized');

  const detailPage = readFileSync(
    path.resolve(process.cwd(), 'admin-site/src/pages/SuggestionDetailPage.tsx'),
    'utf8',
  );
  assert.match(detailPage, /Unauthorized/);
  assert.match(detailPage, /not_authorized|not authorized/i);
});

console.log('\nAll media admin tests passed.');
