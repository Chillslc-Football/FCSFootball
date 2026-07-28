// FCS Media directory suggestion + admin notification email (Resend).
// Redeploy: supabase functions deploy submit-media-suggestion

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_NOTIFY_EMAIL = 'chillslc@gmail.com';

type SubmitBody = {
  provider?: string;
  submitted_url?: string;
  is_national?: boolean;
  conference_ids?: string[] | null;
  team_ids?: string[] | null;
  notes?: string | null;
  coverage_label?: string | null;
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
    console.warn('[submit-media-suggestion] RESEND_API_KEY missing; suggestion stored without email');
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
    console.error('[submit-media-suggestion] Resend error', response.status, detail);
    return { sent: false, error: `Resend HTTP ${response.status}` };
  }

  return { sent: true };
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

  const provider = String(body.provider ?? '').trim().toLowerCase();
  const submittedUrl = String(body.submitted_url ?? '').trim();
  const isNational = Boolean(body.is_national);
  const conferenceIds = uniqueIds(body.conference_ids ?? []);
  const teamIds = uniqueIds(body.team_ids ?? []);
  const notes = String(body.notes ?? '').trim();
  const coverageLabel = String(body.coverage_label ?? '').trim();

  if (!['spotify', 'youtube', 'x'].includes(provider)) {
    return jsonResponse({ error: 'Choose Spotify, YouTube, or X.' }, 400);
  }
  if (!submittedUrl) {
    return jsonResponse({ error: 'Link is required.' }, 400);
  }
  if (!isNational && conferenceIds.length === 0 && teamIds.length === 0) {
    return jsonResponse({ error: 'Choose at least one coverage tag.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: suggestionId, error } = await supabase.rpc('submit_media_suggestion', {
    p_provider: provider,
    p_submitted_url: submittedUrl,
    p_is_national: isNational,
    p_conference_ids: conferenceIds,
    p_team_ids: teamIds,
    p_notes: notes || null,
  });

  if (error) {
    const message = error.message || 'Suggestion failed';
    const status =
      message.includes('coverage') ||
      message.includes('provider') ||
      message.includes('submitted_url') ||
      message.includes('must be')
        ? 400
        : 500;
    return jsonResponse({ error: message }, status);
  }

  const coverageDisplay =
    coverageLabel ||
    [
      isNational ? 'National' : null,
      ...teamIds.map((id) => `Team ${id}`),
      ...conferenceIds.map((id) => id),
    ]
      .filter(Boolean)
      .join(', ') ||
    '—';

  const submittedAt = new Date().toISOString();
  const emailText = [
    'A new FCS Media suggestion requires administrator review.',
    '',
    `Suggestion ID: ${suggestionId}`,
    `Provider: ${provider}`,
    `Link: ${submittedUrl}`,
    `Coverage: ${coverageDisplay}`,
    `Notes: ${notes || 'None provided'}`,
    `Submission date: ${submittedAt}`,
    '',
    'This suggestion is pending and is not public until approved.',
  ].join('\n');

  const emailResult = await sendResendEmail({
    subject: `[FCS Pulse] Media suggestion pending review: ${provider}`,
    text: emailText,
  });

  // Suggestion already saved — always return success even if email fails.
  return jsonResponse({
    ok: true,
    id: suggestionId,
    emailSent: emailResult.sent,
    emailError: emailResult.error ?? null,
  });
});
