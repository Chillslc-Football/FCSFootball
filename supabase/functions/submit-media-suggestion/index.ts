// FCS Media suggestion owner notification (Resend HTML + secure review links).
// Preferred client flow: RPC save → POST { suggestion_id } → email from DB.
//
// Secrets:
//   RESEND_API_KEY
//   MEDIA_SUGGESTION_NOTIFICATION_EMAIL
//   MEDIA_SUGGESTION_FROM_EMAIL
//   MEDIA_SUGGESTION_REVIEW_SECRET
//
// Deploy:
//   supabase.cmd functions deploy submit-media-suggestion

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_ORDER = [
  'website',
  'spotify',
  'apple',
  'youtube',
  'x',
  'facebook',
  'instagram',
  'rss',
  'other',
] as const;

const PLATFORM_LABELS: Record<string, string> = {
  website: 'Website',
  spotify: 'Spotify',
  apple: 'Apple Podcasts',
  youtube: 'YouTube',
  x: 'X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  rss: 'RSS Feed',
  other: 'Other Link',
};

const CONFERENCE_LABELS: Record<string, string> = {
  'big-sky': 'Big Sky',
  'big-south-ovc': 'Big South-OVC',
  caa: 'CAA',
  'fcs-independents': 'FCS Independents',
  'ivy-league': 'Ivy League',
  meac: 'MEAC',
  mvfc: 'Missouri Valley Football Conference',
  nec: 'NEC',
  patriot: 'Patriot League',
  pioneer: 'Pioneer Football League',
  southland: 'Southland',
  southern: 'Southern Conference',
  swac: 'SWAC',
  'united-athletic': 'United Athletic Conference',
};

const TEAM_LABELS: Record<string, string> = {
  '147': 'Montana State',
  '149': 'Montana',
};

const REVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;

type CoverageLabels = {
  teams?: Record<string, string>;
  conferences?: Record<string, string>;
};

type SubmitBody = {
  suggestion_id?: string;
  name?: string;
  platform_links?: Record<string, string> | null;
  provider?: string;
  submitted_url?: string;
  is_national?: boolean;
  conference_ids?: string[] | null;
  team_ids?: string[] | null;
  notes?: string | null;
  submitter_email?: string | null;
  /** Enrichment for notify-by-id when saved coverage_labels are empty. */
  coverage_labels?: CoverageLabels | null;
};

type SuggestionRow = {
  id: string;
  name: string | null;
  provider: string;
  submitted_url: string;
  platform_links: Record<string, string> | null;
  notes: string | null;
  status: string;
  is_national: boolean | null;
  created_at: string;
  owner_notified_at: string | null;
  submitter_email: string | null;
  coverage_labels: CoverageLabels | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function resolveServiceRoleKey(): string | null {
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')?.trim();
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as { secret?: string } | string[];
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as { secret?: string }).secret === 'string'
      ) {
        return (parsed as { secret: string }).secret;
      }
    } catch {
      // fall through
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || null;
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizePlatformLinks(
  raw: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of PLATFORM_ORDER) {
    const value = typeof raw[key] === 'string' ? raw[key].trim() : '';
    if (value) out[key] = value;
  }
  return out;
}

function platformLinksFromRow(row: SuggestionRow): Record<string, string> {
  const fromJson = normalizePlatformLinks(row.platform_links ?? undefined);
  if (Object.keys(fromJson).length > 0) return fromJson;
  const key = String(row.provider ?? '').trim().toLowerCase();
  const url = String(row.submitted_url ?? '').trim();
  if (key && url) return { [key]: url };
  return {};
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    date.toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }) + ' (UTC)'
  );
}

function mergeCoverageLabels(
  primary: CoverageLabels | null | undefined,
  fallback: CoverageLabels | null | undefined,
): CoverageLabels {
  return {
    teams: { ...(fallback?.teams ?? {}), ...(primary?.teams ?? {}) },
    conferences: { ...(fallback?.conferences ?? {}), ...(primary?.conferences ?? {}) },
  };
}

function resolveTeamNames(ids: string[], labels: CoverageLabels | null | undefined): string[] {
  return ids.map((id) => {
    const fromStore = labels?.teams?.[id]?.trim();
    if (fromStore) return fromStore;
    return TEAM_LABELS[id] ?? id;
  });
}

function resolveConferenceNames(
  ids: string[],
  labels: CoverageLabels | null | undefined,
): string[] {
  return ids.map((id) => {
    const fromStore = labels?.conferences?.[id]?.trim();
    if (fromStore) return fromStore;
    return CONFERENCE_LABELS[id] ?? id;
  });
}

function buildReplyMailto(submitterEmail: string, creatorName: string): string {
  const subject = 'Question about your FCS Pulse media suggestion';
  const body = [
    'Hi,',
    '',
    `Thanks for suggesting ${creatorName} for FCS Pulse.`,
    '',
    'I have a quick question:',
    '',
  ].join('\n');
  return `mailto:${encodeURIComponent(submitterEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function issueReviewToken(input: {
  secret: string;
  suggestionId: string;
  nonce: string;
}): Promise<string> {
  const payload = {
    v: 1 as const,
    sid: input.suggestionId,
    act: 'review' as const,
    exp: Math.floor(Date.now() / 1000) + REVIEW_TTL_SECONDS,
    n: input.nonce,
  };
  const bodyB64 = uint8ToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(input.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = uint8ToBase64Url(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyB64))),
  );
  return `${bodyB64}.${sig}`;
}

function createNonce(): string {
  return uint8ToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

type EmailLinkRow = { platform: string; label: string | null; url: string };

function formatLinkHeading(link: EmailLinkRow): string {
  const platform = PLATFORM_LABELS[link.platform] ?? link.platform;
  const label = link.label?.trim();
  return label ? `${platform} · ${label}` : platform;
}

function buildOwnerEmail(details: {
  id: string;
  name: string;
  platformLinks: Record<string, string>;
  links?: EmailLinkRow[];
  isNational: boolean;
  teamNames: string[];
  conferenceNames: string[];
  notes: string | null;
  submitterEmail: string | null;
  status: string;
  submittedAt: string;
  reviewUrl: string | null;
  approveUrl: string | null;
  rejectUrl: string | null;
}): { subject: string; text: string; html: string; replyTo: string | null } {
  const name = details.name.trim() || 'Untitled';
  const submitter = details.submitterEmail?.trim().toLowerCase() || null;
  const submittedAt = formatSubmittedAt(details.submittedAt);
  const notes = details.notes?.trim() || 'None';

  let populatedLinks: EmailLinkRow[] = details.links ?? [];
  if (populatedLinks.length === 0) {
    populatedLinks = PLATFORM_ORDER.flatMap((key) => {
      const url = details.platformLinks[key];
      if (!url) return [];
      return [{ platform: key, label: null, url }];
    });
  }

  const textLinkLines =
    populatedLinks.length > 0
      ? populatedLinks.flatMap((link) => [formatLinkHeading(link), link.url, ''])
      : ['None', ''];

  const replyMailto = submitter ? buildReplyMailto(submitter, name) : null;

  const text = [
    'A new FCS Media suggestion was saved and needs review.',
    '',
    `Creator or Podcast Name: ${name}`,
    '',
    'Platform Links:',
    ...textLinkLines,
    '',
    `National: ${details.isNational ? 'Yes' : 'No'}`,
    `Teams: ${details.teamNames.length > 0 ? details.teamNames.join(', ') : 'None'}`,
    `Conferences: ${details.conferenceNames.length > 0 ? details.conferenceNames.join(', ') : 'None'}`,
    `Notes: ${notes}`,
    `Submitter Email: ${submitter ?? 'None'}`,
    '',
    `Suggestion ID: ${details.id}`,
    `Status: ${details.status}`,
    `Submitted Timestamp: ${submittedAt}`,
    '',
    details.reviewUrl ? `Review: ${details.reviewUrl}` : null,
    details.approveUrl ? `Approve: ${details.approveUrl}` : null,
    details.rejectUrl ? `Reject: ${details.rejectUrl}` : null,
    replyMailto ? `Reply: ${replyMailto}` : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const linkHtml =
    populatedLinks.length > 0
      ? populatedLinks
          .map((link) => {
            const heading = formatLinkHeading(link);
            return `<div style="margin:0 0 12px 0;font-size:15px;line-height:1.4;">
                <div style="font-weight:700;color:#E8EEF7;margin-bottom:2px;">${escapeHtml(heading)}</div>
                <a href="${escapeHtml(link.url)}" style="color:#C9A227;word-break:break-all;">${escapeHtml(link.url)}</a>
              </div>`;
          })
          .join('')
      : `<div style="color:#9AA6B2;font-size:15px;">None</div>`;

  const buttonRow = [
    details.reviewUrl
      ? `<a href="${escapeHtml(details.reviewUrl)}" style="display:inline-block;background:#C9A227;color:#0F1419;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;margin:0 8px 8px 0;">Open in Media Admin</a>`
      : '',
    replyMailto
      ? `<a href="${escapeHtml(replyMailto)}" style="display:inline-block;background:transparent;color:#C9A227;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;border:1px solid #C9A227;margin:0 8px 8px 0;">Reply</a>`
      : '',
  ].join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FCS Pulse media suggestion</title>
<!-- fcs-pulse-media-suggestion-email-v2 -->
</head>
<body style="margin:0;padding:0;background:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E8EEF7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#1A2230;border-radius:12px;overflow:hidden;border:1px solid #2A3545;">
          <tr>
            <td style="padding:24px 24px 12px 24px;background:#121820;">
              <div style="font-size:22px;font-weight:800;letter-spacing:0.02em;color:#C9A227;">FCS Pulse</div>
              <div style="margin-top:6px;font-size:16px;color:#E8EEF7;">New media suggestion ready for review</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;">
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Creator or Podcast Name</div>
              <div style="font-size:20px;font-weight:700;color:#FFFFFF;margin-bottom:18px;">${escapeHtml(name)}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:8px;">Platform Links</div>
              <div style="margin-bottom:18px;">${linkHtml}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Coverage</div>
              <div style="font-size:15px;margin-bottom:6px;"><strong>National:</strong> ${details.isNational ? 'Yes' : 'No'}</div>
              <div style="font-size:15px;margin-bottom:6px;"><strong>Teams:</strong> ${escapeHtml(details.teamNames.length > 0 ? details.teamNames.join(', ') : 'None')}</div>
              <div style="font-size:15px;margin-bottom:18px;"><strong>Conferences:</strong> ${escapeHtml(details.conferenceNames.length > 0 ? details.conferenceNames.join(', ') : 'None')}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Notes</div>
              <div style="font-size:15px;margin-bottom:18px;white-space:pre-wrap;">${escapeHtml(notes)}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Submitter Email</div>
              <div style="font-size:15px;margin-bottom:18px;">${submitter ? escapeHtml(submitter) : 'None'}</div>
              <div style="font-size:14px;color:#9AA6B2;line-height:1.6;margin-bottom:22px;">
                <div><strong style="color:#E8EEF7;">Suggestion ID:</strong> ${escapeHtml(details.id)}</div>
                <div><strong style="color:#E8EEF7;">Status:</strong> ${escapeHtml(details.status)}</div>
                <div><strong style="color:#E8EEF7;">Submitted Timestamp:</strong> ${escapeHtml(submittedAt)}</div>
              </div>
              <div>${buttonRow}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px 24px;color:#6F7B88;font-size:12px;line-height:1.5;">
              Approve and Reject open a secure FCS Pulse confirmation page. Approval only updates review status and does not publish the creator yet.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `New FCS Pulse media suggestion: ${name}`,
    text,
    html,
    replyTo: submitter,
  };
}

async function sendResendEmail(payload: {
  suggestionId: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const to = Deno.env.get('MEDIA_SUGGESTION_NOTIFICATION_EMAIL')?.trim();
  const from = Deno.env.get('MEDIA_SUGGESTION_FROM_EMAIL')?.trim();

  if (!apiKey) {
    console.warn('[submit-media-suggestion] RESEND_API_KEY missing; skipping email');
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }
  if (!to) {
    console.warn(
      '[submit-media-suggestion] MEDIA_SUGGESTION_NOTIFICATION_EMAIL missing; skipping email',
    );
    return { sent: false, error: 'MEDIA_SUGGESTION_NOTIFICATION_EMAIL not configured' };
  }
  if (!from) {
    console.warn(
      '[submit-media-suggestion] MEDIA_SUGGESTION_FROM_EMAIL missing; skipping email',
    );
    return { sent: false, error: 'MEDIA_SUGGESTION_FROM_EMAIL not configured' };
  }

  const body: Record<string, unknown> = {
    from,
    to: [to],
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  };
  if (payload.replyTo) {
    body.reply_to = payload.replyTo;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `media-suggestion/${payload.suggestionId}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[submit-media-suggestion] Resend error', response.status, detail);
    return { sent: false, error: `Resend HTTP ${response.status}` };
  }

  return { sent: true };
}

async function loadSuggestionBundle(
  supabase: SupabaseClient,
  suggestionId: string,
): Promise<{
  row: SuggestionRow;
  teamIds: string[];
  conferenceIds: string[];
  links: EmailLinkRow[];
} | null> {
  // Prefer full column set; fall back if newer columns are not migrated yet.
  let row: Record<string, unknown> | null = null;
  const full = await supabase
    .from('media_suggestions')
    .select(
      'id, name, provider, submitted_url, platform_links, notes, status, is_national, created_at, owner_notified_at, submitter_email, coverage_labels',
    )
    .eq('id', suggestionId)
    .maybeSingle();

  if (full.error) {
    console.warn(
      '[submit-media-suggestion] full suggestion select failed; retrying without newer columns',
      full.error.message,
    );
    const basic = await supabase
      .from('media_suggestions')
      .select(
        'id, name, provider, submitted_url, platform_links, notes, status, is_national, created_at, owner_notified_at',
      )
      .eq('id', suggestionId)
      .maybeSingle();
    if (basic.error) {
      console.error('[submit-media-suggestion] load suggestion failed', basic.error.message);
      return null;
    }
    row = basic.data as Record<string, unknown> | null;
  } else {
    row = full.data as Record<string, unknown> | null;
  }

  if (!row) return null;

  const [{ data: teamRows }, { data: confRows }, { data: linkRows }] = await Promise.all([
    supabase
      .from('media_suggestion_teams')
      .select('team_id')
      .eq('media_suggestion_id', suggestionId),
    supabase
      .from('media_suggestion_conferences')
      .select('conference_id')
      .eq('media_suggestion_id', suggestionId),
    supabase
      .from('media_suggestion_links')
      .select('platform, label, url, sort_order')
      .eq('media_suggestion_id', suggestionId)
      .order('sort_order', { ascending: true }),
  ]);

  const links: EmailLinkRow[] = (linkRows ?? [])
    .map((r: { platform?: string; label?: string | null; url?: string }) => ({
      platform: String(r.platform ?? '').trim(),
      label: typeof r.label === 'string' ? r.label : null,
      url: String(r.url ?? '').trim(),
    }))
    .filter((r: EmailLinkRow) => r.platform && r.url);

  return {
    row: {
      ...(row as unknown as SuggestionRow),
      submitter_email:
        typeof row.submitter_email === 'string' ? row.submitter_email : null,
      coverage_labels:
        row.coverage_labels && typeof row.coverage_labels === 'object'
          ? (row.coverage_labels as CoverageLabels)
          : null,
    },
    teamIds: uniqueIds((teamRows ?? []).map((r: { team_id?: string }) => r.team_id)),
    conferenceIds: uniqueIds(
      (confRows ?? []).map((r: { conference_id?: string }) => r.conference_id),
    ),
    links,
  };
}

async function notifyFromSavedSuggestion(
  supabase: SupabaseClient,
  suggestionId: string,
  enrichment?: { coverage_labels?: CoverageLabels | null },
): Promise<{
  ok: true;
  id: string;
  emailSent: boolean;
  emailError: string | null;
  alreadyNotified?: boolean;
}> {
  const bundle = await loadSuggestionBundle(supabase, suggestionId);
  if (!bundle) {
    throw new Error(`Suggestion not found: ${suggestionId}`);
  }

  const { row, teamIds, conferenceIds, links } = bundle;

  if (row.owner_notified_at) {
    console.log(
      '[submit-media-suggestion] already notified',
      suggestionId,
      row.owner_notified_at,
    );
    return {
      ok: true,
      id: row.id,
      emailSent: true,
      emailError: null,
      alreadyNotified: true,
    };
  }

  const name = (row.name && String(row.name).trim()) || `${row.provider} suggestion`;
  const platformLinks = platformLinksFromRow(row);
  const submitterEmail = row.submitter_email?.trim().toLowerCase() || null;
  const coverageLabels = mergeCoverageLabels(row.coverage_labels, enrichment?.coverage_labels);
  // Authenticated Media Admin (no public token review links).
  const adminBase = (
    Deno.env.get('MEDIA_ADMIN_SITE_URL')?.trim() || 'https://admin.fcspulse.com'
  ).replace(/\/$/, '');
  const reviewUrl = `${adminBase}/suggestions/${encodeURIComponent(row.id)}`;

  const email = buildOwnerEmail({
    id: row.id,
    name,
    platformLinks,
    links,
    isNational: Boolean(row.is_national),
    teamNames: resolveTeamNames(teamIds, coverageLabels),
    conferenceNames: resolveConferenceNames(conferenceIds, coverageLabels),
    notes: row.notes,
    submitterEmail,
    status: row.status || 'pending',
    submittedAt: row.created_at,
    reviewUrl,
    approveUrl: null,
    rejectUrl: null,
  });

  const emailResult = await sendResendEmail({
    suggestionId: row.id,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: email.replyTo,
  });

  if (emailResult.sent) {
    const { error: markError } = await supabase
      .from('media_suggestions')
      .update({ owner_notified_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('owner_notified_at', null);

    if (markError) {
      console.error(
        '[submit-media-suggestion] failed to set owner_notified_at',
        markError.message,
      );
    }
  } else {
    console.error(
      '[submit-media-suggestion] email not sent; suggestion kept',
      row.id,
      emailResult.error,
    );
  }

  return {
    ok: true,
    id: row.id,
    emailSent: emailResult.sent,
    emailError: emailResult.error ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = resolveServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const notifyId = String(body.suggestion_id ?? '').trim();

  if (notifyId) {
    try {
      const result = await notifyFromSavedSuggestion(supabase, notifyId, {
        coverage_labels: body.coverage_labels ?? null,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notify failed';
      console.error('[submit-media-suggestion] notify-by-id failed', message);
      return jsonResponse(
        {
          ok: true,
          id: notifyId,
          emailSent: false,
          emailError: message,
        },
        200,
      );
    }
  }

  // Legacy combined path: save then notify from DB.
  const name = String(body.name ?? '').trim();
  let platformLinks = normalizePlatformLinks(body.platform_links);
  if (Object.keys(platformLinks).length === 0 && body.provider && body.submitted_url) {
    const key = String(body.provider).trim().toLowerCase();
    const url = String(body.submitted_url).trim();
    if (key && url) platformLinks = { [key]: url };
  }

  const isNational = Boolean(body.is_national);
  const conferenceIds = uniqueIds(body.conference_ids ?? []);
  const teamIds = uniqueIds(body.team_ids ?? []);
  const notes = String(body.notes ?? '').trim();
  const submitterEmail = String(body.submitter_email ?? '').trim().toLowerCase();
  const coverageLabels = body.coverage_labels ?? { teams: {}, conferences: {} };

  if (!name) {
    return jsonResponse({ error: 'Creator or podcast name is required.' }, 400);
  }
  if (!submitterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    return jsonResponse({ error: 'Enter a valid email address.' }, 400);
  }
  if (Object.keys(platformLinks).length === 0) {
    return jsonResponse({ error: 'Add at least one link.' }, 400);
  }
  if (!isNational && conferenceIds.length === 0 && teamIds.length === 0) {
    return jsonResponse({ error: 'Choose at least one coverage tag.' }, 400);
  }

  const { data: suggestionId, error } = await supabase.rpc('submit_media_suggestion', {
    p_name: name,
    p_platform_links: platformLinks,
    p_is_national: isNational,
    p_conference_ids: conferenceIds,
    p_team_ids: teamIds,
    p_coverage_labels: coverageLabels,
    p_submitter_email: submitterEmail,
    p_notes: notes || null,
  });

  if (error) {
    const message = error.message || 'Suggestion failed';
    const status =
      message.includes('coverage') ||
      message.includes('name') ||
      message.includes('platform') ||
      message.includes('email') ||
      message.includes('must be') ||
      message.includes('required')
        ? 400
        : 500;
    return jsonResponse({ error: message }, status);
  }

  const id = String(suggestionId);
  try {
    const result = await notifyFromSavedSuggestion(supabase, id);
    return jsonResponse(result, 200);
  } catch (notifyError) {
    const message =
      notifyError instanceof Error ? notifyError.message : 'Notify failed';
    console.error('[submit-media-suggestion] saved but email failed', id, message);
    return jsonResponse({
      ok: true,
      id,
      emailSent: false,
      emailError: message,
    });
  }
});
