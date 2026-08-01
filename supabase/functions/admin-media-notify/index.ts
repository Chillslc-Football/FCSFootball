// Authenticated admin outcome emails for media suggestions.
// Deploy: supabase.cmd functions deploy admin-media-notify
//
// Secrets: RESEND_API_KEY
// Optional: MEDIA_SUGGESTION_FROM_EMAIL (defaults to notifications@fcspulse.com)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const DEFAULT_FROM = 'FCS Pulse <notifications@fcspulse.com>';

type Body = {
  suggestion_id?: string;
  outcome?: 'approved' | 'rejected';
  notify?: boolean;
};

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  });
  const allowed = new Set([
    'https://admin.fcspulse.com',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
  ]);
  const normalized = origin?.trim().replace(/\/$/, '') || '';
  if (normalized && allowed.has(normalized)) {
    headers.set('Access-Control-Allow-Origin', normalized);
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function buildOutcomeEmail(input: {
  outcome: 'approved' | 'rejected';
  creatorName: string;
}): { subject: string; text: string; html: string } {
  const creator = input.creatorName.trim() || 'your suggestion';
  if (input.outcome === 'approved') {
    const text = [
      'Thanks for helping improve FCS Pulse.',
      '',
      `Your suggestion for ${creator} has been accepted for inclusion. It may take a little time before it appears in the directory while the listing is reviewed and completed.`,
      '',
      'FCS Pulse',
    ].join('\n');
    return {
      subject: 'Your FCS Pulse media suggestion was accepted',
      text,
      html: `<p>Thanks for helping improve FCS Pulse.</p><p>Your suggestion for <strong>${creator}</strong> has been accepted for inclusion. It may take a little time before it appears in the directory while the listing is reviewed and completed.</p><p>FCS Pulse</p>`,
    };
  }
  const text = [
    `Thanks for taking the time to submit ${creator}.`,
    '',
    'After reviewing it, we decided not to add it at this time.',
    '',
    'FCS Pulse',
  ].join('\n');
  return {
    subject: 'Update on your FCS Pulse media suggestion',
    text,
    html: `<p>Thanks for taking the time to submit <strong>${creator}</strong>.</p><p>After reviewing it, we decided not to add it at this time.</p><p>FCS Pulse</p>`,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    (() => {
      try {
        const raw = Deno.env.get('SUPABASE_SECRET_KEYS')?.trim();
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { secret?: string } | string[];
        if (Array.isArray(parsed)) return parsed[0] ?? null;
        return parsed.secret ?? null;
      } catch {
        return null;
      }
    })();

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'misconfigured' }, 500, origin);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return json({ ok: false, error: 'unauthorized' }, 401, origin);
  }

  const { data: isAdmin, error: adminError } = await userClient.rpc('is_app_admin');
  if (adminError || !isAdmin) {
    return json({ ok: false, error: 'forbidden' }, 403, origin);
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400, origin);
  }

  const suggestionId = String(body.suggestion_id ?? '').trim();
  const outcome = body.outcome;
  const notify = body.notify !== false;
  if (!suggestionId || (outcome !== 'approved' && outcome !== 'rejected')) {
    return json({ ok: false, error: 'invalid_body' }, 400, origin);
  }
  if (!notify) {
    return json({ ok: true, skipped: true, submitterNotified: false }, 200, origin);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: row, error } = await admin
    .from('media_suggestions')
    .select('id, name, submitter_email, status, outcome_notified_at')
    .eq('id', suggestionId)
    .maybeSingle();

  if (error || !row) {
    return json({ ok: false, error: 'not_found' }, 404, origin);
  }
  if (row.outcome_notified_at) {
    return json({ ok: true, submitterNotified: false, alreadyNotified: true }, 200, origin);
  }

  const to = typeof row.submitter_email === 'string' ? row.submitter_email.trim().toLowerCase() : '';
  if (!to) {
    return json({ ok: true, submitterNotified: false, reason: 'no_submitter_email' }, 200, origin);
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  if (!apiKey) {
    console.warn('[admin-media-notify] RESEND_API_KEY missing');
    return json({ ok: false, error: 'email_not_configured' }, 500, origin);
  }

  const creatorName =
    (typeof row.name === 'string' && row.name.trim()) || 'your suggestion';
  const email = buildOutcomeEmail({ outcome, creatorName });
  const from =
    Deno.env.get('MEDIA_SUGGESTION_FROM_EMAIL')?.trim() || DEFAULT_FROM;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `media-suggestion-outcome/${suggestionId}/${outcome}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    console.error('[admin-media-notify] Resend error', response.status, await response.text());
    return json({ ok: false, error: 'email_failed' }, 502, origin);
  }

  await admin
    .from('media_suggestions')
    .update({ outcome_notified_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .is('outcome_notified_at', null);

  return json({ ok: true, submitterNotified: true }, 200, origin);
});
