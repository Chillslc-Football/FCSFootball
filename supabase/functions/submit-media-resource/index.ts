// Secure creator-first media submission + admin notification email (Resend).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_NOTIFY_EMAIL = 'chillslc@gmail.com';

type SubmitLink = {
  link_type?: string;
  resource_type?: string;
  url?: string;
  label?: string | null;
};

type SubmitBody = {
  submission_type?: string;
  existing_creator_id?: string | null;
  proposed_name?: string | null;
  proposed_description?: string | null;
  submitted_name?: string | null;
  description?: string | null;
  scope?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  resource_type?: string;
  submitted_url?: string;
  submitter_name?: string | null;
  submitter_email?: string | null;
  submitter_notes?: string | null;
  links?: SubmitLink[];
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
      if (parsed && typeof parsed === 'object' && typeof (parsed as { secret?: string }).secret === 'string') {
        return (parsed as { secret: string }).secret;
      }
    } catch {
      // fall through
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || null;
}

async function sendResendEmail(payload: {
  subject: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const from = Deno.env.get('RESEND_FROM_EMAIL')?.trim() || 'FCS Pulse <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[submit-media-resource] RESEND_API_KEY missing; submission stored without email');
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [ADMIN_NOTIFY_EMAIL],
      subject: payload.subject,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[submit-media-resource] Resend error', response.status, detail);
    return { sent: false, error: `Resend HTTP ${response.status}` };
  }

  return { sent: true };
}

function normalizeBody(body: SubmitBody): Record<string, unknown> {
  // Backward compatible: old single-link payloads become a one-link new_creator submission.
  if ((!body.links || body.links.length === 0) && body.submitted_url && body.resource_type) {
    return {
      submission_type: 'new_creator',
      proposed_name: body.proposed_name ?? body.submitted_name,
      proposed_description: body.proposed_description ?? body.description,
      scope: body.scope,
      team_id: body.team_id,
      team_name: body.team_name,
      submitter_name: body.submitter_name,
      submitter_email: body.submitter_email,
      submitter_notes: body.submitter_notes,
      links: [
        {
          link_type: body.resource_type,
          url: body.submitted_url,
        },
      ],
    };
  }

  return {
    submission_type: body.submission_type,
    existing_creator_id: body.existing_creator_id,
    proposed_name: body.proposed_name ?? body.submitted_name,
    proposed_description: body.proposed_description ?? body.description,
    scope: body.scope,
    team_id: body.team_id,
    team_name: body.team_name,
    submitter_name: body.submitter_name,
    submitter_email: body.submitter_email,
    submitter_notes: body.submitter_notes,
    links: (body.links ?? []).map((link) => ({
      link_type: link.link_type ?? link.resource_type,
      url: link.url,
      label: link.label ?? null,
    })),
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

  const payload = normalizeBody(body);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: submissionId, error } = await supabase.rpc('submit_media_creator_submission', {
    p_payload: payload,
  });

  if (error) {
    const message = error.message || 'Submission failed';
    const status = message.includes('duplicate_submission')
      ? 409
      : message.includes('required') ||
          message.includes('must be') ||
          message.includes('invalid') ||
          message.includes('at least one')
        ? 400
        : 500;
    return jsonResponse({ error: message }, status);
  }

  const links = (payload.links as Array<{ link_type?: string; url?: string; label?: string | null }>) ?? [];
  const linkLines = links.map((link, index) => {
    const type = link.link_type ?? 'link';
    const label = link.label?.trim() ? ` (${link.label.trim()})` : '';
    return `${index + 1}. ${type}${label}: ${link.url ?? ''}`;
  });

  const submissionType = String(payload.submission_type ?? '');
  const creatorName = String(payload.proposed_name ?? 'Untitled');
  const scope = String(payload.scope ?? '—');
  const submittedAt = new Date().toISOString();

  const emailText = [
    'A new FCS media submission requires administrator review.',
    '',
    `Submission ID: ${submissionId}`,
    `Creator / outlet: ${creatorName}`,
    `Submission type: ${
      submissionType === 'add_links' ? 'Add links to existing creator' : 'New creator or outlet'
    }`,
    `Scope: ${scope}`,
    `Team: ${scope === 'team' ? String(payload.team_name ?? payload.team_id ?? '—') : 'N/A (national)'}`,
    `Description: ${String(payload.proposed_description ?? '').trim() || '—'}`,
    '',
    'Links:',
    ...(linkLines.length ? linkLines : ['(none)']),
    '',
    `Submitter name: ${String(payload.submitter_name ?? '').trim() || '—'}`,
    `Submitter email: ${String(payload.submitter_email ?? '').trim() || '—'}`,
    `Submitter notes: ${String(payload.submitter_notes ?? '').trim() || '—'}`,
    `Submission date: ${submittedAt}`,
    '',
    'This submission is pending and is not public until approved in the FCS Pulse admin area.',
  ].join('\n');

  const emailResult = await sendResendEmail({
    subject: `[FCS Pulse] Media submission pending review: ${creatorName}`,
    text: emailText,
  });

  return jsonResponse({
    ok: true,
    submissionId,
    emailSent: emailResult.sent,
    emailError: emailResult.error ?? null,
  });
});
