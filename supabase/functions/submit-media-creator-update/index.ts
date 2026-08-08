// Owner notification for "Update Your Creator Page" (media_correction_suggestions).
// Client flow: RPC save → POST { correction_id } → email from DB.
//
// Reuses the same Resend secrets as submit-media-suggestion:
//   RESEND_API_KEY
//   MEDIA_SUGGESTION_NOTIFICATION_EMAIL
//   MEDIA_SUGGESTION_FROM_EMAIL
//   MEDIA_ADMIN_SITE_URL (optional; default https://admin.fcspulse.com)
//
// Deploy:
//   supabase.cmd functions deploy submit-media-creator-update

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

type SubmitBody = {
  correction_id?: string;
};

type CorrectionRow = {
  id: string;
  media_source_id: string | null;
  correction_type: string;
  proposed_changes: Record<string, unknown> | null;
  details: string | null;
  submitter_email: string | null;
  status: string;
  created_at: string;
  owner_notified_at: string | null;
};

type SourceRow = {
  id: string;
  name: string | null;
};

type EmailLink = {
  platform: string;
  label: string | null;
  url: string;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseLinks(proposed: Record<string, unknown>): EmailLink[] {
  const raw = proposed.links;
  if (!Array.isArray(raw)) return [];
  const out: EmailLink[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    const platform = String(record.platform ?? '').trim().toLowerCase();
    const url = String(record.url ?? '').trim();
    if (!platform || !url) continue;
    const label =
      typeof record.label === 'string' && record.label.trim() ? record.label.trim() : null;
    out.push({ platform, label, url });
  }
  return out;
}

function linkHeading(link: EmailLink): string {
  const platform = PLATFORM_LABELS[link.platform] ?? link.platform;
  return link.label ? `${platform} · ${link.label}` : platform;
}

function buildOwnerEmail(input: {
  id: string;
  creatorName: string;
  description: string | null;
  links: EmailLink[];
  notes: string | null;
  submitterEmail: string | null;
  status: string;
  submittedAt: string;
  reviewUrl: string | null;
}): { subject: string; text: string; html: string; replyTo: string | null } {
  const name = input.creatorName.trim() || 'Creator';
  const submitter = input.submitterEmail?.trim().toLowerCase() || null;
  const notes = input.notes?.trim() || 'None';
  const description = input.description?.trim() || 'None';
  const submittedAt = formatSubmittedAt(input.submittedAt);

  const textLinkLines =
    input.links.length > 0
      ? input.links.flatMap((link) => [linkHeading(link), link.url, ''])
      : ['None', ''];

  const replyMailto = submitter
    ? `mailto:${encodeURIComponent(submitter)}?subject=${encodeURIComponent(
        `Question about your FCS Pulse creator update (${name})`,
      )}`
    : null;

  const text = [
    'A creator requested updates to an existing FCS Media page.',
    '',
    `Creator: ${name}`,
    `Submitter Email: ${submitter ?? 'None'}`,
    '',
    'Proposed Description:',
    description,
    '',
    'Proposed Links:',
    ...textLinkLines,
    '',
    `Note: ${notes}`,
    '',
    `Correction ID: ${input.id}`,
    `Status: ${input.status}`,
    `Submitted: ${submittedAt}`,
    input.reviewUrl ? `Review: ${input.reviewUrl}` : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const linkHtml =
    input.links.length > 0
      ? input.links
          .map((link) => {
            const heading = linkHeading(link);
            return `<div style="margin:0 0 12px 0;font-size:15px;line-height:1.4;">
                <div style="font-weight:700;color:#E8EEF7;margin-bottom:2px;">${escapeHtml(heading)}</div>
                <a href="${escapeHtml(link.url)}" style="color:#C9A227;word-break:break-all;">${escapeHtml(link.url)}</a>
              </div>`;
          })
          .join('')
      : `<div style="color:#9AA6B2;font-size:15px;">None</div>`;

  const buttonRow = [
    input.reviewUrl
      ? `<a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;background:#C9A227;color:#0F1419;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;margin:0 8px 8px 0;">Open in Media Admin</a>`
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
<title>FCS Pulse creator update</title>
</head>
<body style="margin:0;padding:0;background:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E8EEF7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#1A2230;border-radius:12px;overflow:hidden;border:1px solid #2A3545;">
          <tr>
            <td style="padding:24px 24px 12px 24px;background:#121820;">
              <div style="font-size:22px;font-weight:800;letter-spacing:0.02em;color:#C9A227;">FCS Pulse</div>
              <div style="margin-top:6px;font-size:16px;color:#E8EEF7;">Creator update ready for review</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;">
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Creator</div>
              <div style="font-size:20px;font-weight:700;color:#FFFFFF;margin-bottom:18px;">${escapeHtml(name)}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Proposed Description</div>
              <div style="font-size:15px;margin-bottom:18px;white-space:pre-wrap;">${escapeHtml(description)}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:8px;">Proposed Links</div>
              <div style="margin-bottom:18px;">${linkHtml}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Note</div>
              <div style="font-size:15px;margin-bottom:18px;white-space:pre-wrap;">${escapeHtml(notes)}</div>
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Submitter Email</div>
              <div style="font-size:15px;margin-bottom:18px;">${submitter ? escapeHtml(submitter) : 'None'}</div>
              <div style="font-size:14px;color:#9AA6B2;line-height:1.6;margin-bottom:22px;">
                <div><strong style="color:#E8EEF7;">Correction ID:</strong> ${escapeHtml(input.id)}</div>
                <div><strong style="color:#E8EEF7;">Status:</strong> ${escapeHtml(input.status)}</div>
                <div><strong style="color:#E8EEF7;">Submitted:</strong> ${escapeHtml(submittedAt)}</div>
              </div>
              <div>${buttonRow}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px 24px;color:#6F7B88;font-size:12px;line-height:1.5;">
              Live creator data is unchanged until you apply this update in Media Admin → Reports.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `FCS Pulse Creator Update: ${name}`,
    text,
    html,
    replyTo: submitter,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  let body: SubmitBody = {};
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const correctionId = String(body.correction_id ?? '').trim();
  if (!correctionId) {
    return jsonResponse({ error: 'correction_id_required', emailSent: false }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = resolveServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'server_misconfigured', emailSent: false }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: correctionRaw, error: loadError } = await supabase
    .from('media_correction_suggestions')
    .select(
      'id, media_source_id, correction_type, proposed_changes, details, submitter_email, status, created_at, owner_notified_at',
    )
    .eq('id', correctionId)
    .maybeSingle();

  if (loadError) {
    console.error('[submit-media-creator-update] load failed', loadError.message);
    return jsonResponse({ error: 'load_failed', emailSent: false }, 500);
  }

  const correction = correctionRaw as CorrectionRow | null;
  if (!correction) {
    return jsonResponse({ error: 'not_found', emailSent: false }, 404);
  }

  if (correction.owner_notified_at) {
    return jsonResponse({ ok: true, emailSent: true, alreadyNotified: true });
  }

  let creatorName = 'Creator';
  if (correction.media_source_id) {
    const { data: sourceRaw } = await supabase
      .from('media_sources')
      .select('id, name')
      .eq('id', correction.media_source_id)
      .maybeSingle();
    const source = sourceRaw as SourceRow | null;
    if (source?.name?.trim()) creatorName = source.name.trim();
  }

  const proposed = asRecord(correction.proposed_changes);
  const description =
    typeof proposed.description === 'string' ? proposed.description : null;
  const links = parseLinks(proposed);
  const adminBase =
    Deno.env.get('MEDIA_ADMIN_SITE_URL')?.trim().replace(/\/+$/, '') ||
    'https://admin.fcspulse.com';
  const reviewUrl = `${adminBase}/reports/${correction.id}`;

  const email = buildOwnerEmail({
    id: correction.id,
    creatorName,
    description,
    links,
    notes: correction.details,
    submitterEmail: correction.submitter_email,
    status: correction.status,
    submittedAt: correction.created_at,
    reviewUrl,
  });

  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const to = Deno.env.get('MEDIA_SUGGESTION_NOTIFICATION_EMAIL')?.trim();
  const from = Deno.env.get('MEDIA_SUGGESTION_FROM_EMAIL')?.trim();

  if (!apiKey || !to || !from) {
    console.warn('[submit-media-creator-update] Resend env missing; skipping email');
    return jsonResponse({ ok: true, emailSent: false, error: 'email_not_configured' });
  }

  const resendBody: Record<string, unknown> = {
    from,
    to: [to],
    subject: email.subject,
    text: email.text,
    html: email.html,
  };
  if (email.replyTo) resendBody.reply_to = email.replyTo;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `media-creator-update/${correction.id}`,
    },
    body: JSON.stringify(resendBody),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[submit-media-creator-update] Resend error', response.status, detail);
    return jsonResponse({ ok: true, emailSent: false, error: 'resend_failed' });
  }

  const { error: markError } = await supabase
    .from('media_correction_suggestions')
    .update({ owner_notified_at: new Date().toISOString() })
    .eq('id', correction.id)
    .is('owner_notified_at', null);

  if (markError) {
    console.warn('[submit-media-creator-update] mark notified failed', markError.message);
  }

  return jsonResponse({ ok: true, emailSent: true });
});
