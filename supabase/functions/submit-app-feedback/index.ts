// App feedback owner notification (Resend).
// Preferred client flow: RPC save → POST { feedback_id } → email from DB.
//
// Secrets:
//   RESEND_API_KEY
//   MEDIA_SUGGESTION_NOTIFICATION_EMAIL (reuse owner inbox)
//   MEDIA_SUGGESTION_FROM_EMAIL or RESEND_FROM_EMAIL
//
// Deploy:
//   supabase.cmd functions deploy submit-app-feedback

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SubmitBody = {
  feedback_id?: string;
};

type FeedbackRow = {
  id: string;
  message: string;
  email: string | null;
  category: string | null;
  created_at: string;
  owner_notified_at: string | null;
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

function categoryLabel(category: string | null): string {
  switch ((category ?? '').toLowerCase()) {
    case 'bug':
      return 'Bug';
    case 'idea':
      return 'Idea';
    case 'other':
      return 'Other';
    default:
      return 'General';
  }
}

async function sendResendEmail(payload: {
  subject: string;
  text: string;
  replyTo?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const to = Deno.env.get('MEDIA_SUGGESTION_NOTIFICATION_EMAIL')?.trim();
  const from =
    Deno.env.get('MEDIA_SUGGESTION_FROM_EMAIL')?.trim() ||
    Deno.env.get('RESEND_FROM_EMAIL')?.trim() ||
    'FCS Pulse <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[submit-app-feedback] RESEND_API_KEY missing; skipping email');
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }
  if (!to) {
    console.warn(
      '[submit-app-feedback] MEDIA_SUGGESTION_NOTIFICATION_EMAIL missing; skipping email',
    );
    return { sent: false, error: 'MEDIA_SUGGESTION_NOTIFICATION_EMAIL not configured' };
  }

  const body: Record<string, unknown> = {
    from,
    to: [to],
    subject: payload.subject,
    text: payload.text,
  };
  if (payload.replyTo) {
    body.reply_to = payload.replyTo;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[submit-app-feedback] Resend error', response.status, detail);
    return { sent: false, error: `Resend HTTP ${response.status}` };
  }

  return { sent: true };
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
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const feedbackId = body.feedback_id?.trim();
  if (!feedbackId) {
    return jsonResponse({ error: 'feedback_id is required' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase
    .from('app_feedback')
    .select('id, message, email, category, created_at, owner_notified_at')
    .eq('id', feedbackId)
    .maybeSingle();

  if (error) {
    console.error('[submit-app-feedback] load failed', error.message);
    return jsonResponse({ error: 'Could not load feedback' }, 500);
  }

  const row = data as FeedbackRow | null;
  if (!row) {
    return jsonResponse({ error: 'Feedback not found' }, 404);
  }

  if (row.owner_notified_at) {
    return jsonResponse({ emailSent: true, alreadyNotified: true });
  }

  const label = categoryLabel(row.category);
  const replyTo = row.email?.trim() || null;
  const text = [
    `New FCS Pulse feedback (${label})`,
    '',
    row.message,
    '',
    replyTo ? `Reply-to: ${replyTo}` : 'No email provided',
    `Submitted: ${row.created_at}`,
    `ID: ${row.id}`,
  ].join('\n');

  const emailResult = await sendResendEmail({
    subject: `[FCS Pulse Feedback] ${label}`,
    text,
    replyTo,
  });

  if (emailResult.sent) {
    const { error: updateError } = await supabase
      .from('app_feedback')
      .update({ owner_notified_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) {
      console.warn('[submit-app-feedback] owner_notified_at update failed', updateError.message);
    }
  }

  return jsonResponse({ emailSent: emailResult.sent, error: emailResult.error ?? null });
});
