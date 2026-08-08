import {
  getSupabaseAnonKey,
  getSupabaseClient,
  getSupabaseUrl,
} from '@/data/notifications/supabaseClient';

export type AppFeedbackCategory = 'bug' | 'idea' | 'other';

export type SubmitAppFeedbackResult =
  | { ok: true; id: string; emailSent?: boolean }
  | { ok: false; error: string };

async function notifyAppFeedbackOwner(feedbackId: string): Promise<boolean> {
  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) return false;

  try {
    const response = await fetch(`${baseUrl}/functions/v1/submit-app-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ feedback_id: feedbackId }),
    });

    let payload: { emailSent?: boolean } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      return false;
    }
    return Boolean(payload.emailSent);
  } catch {
    return false;
  }
}

/**
 * Public app feedback.
 * 1) Save via RPC (source of truth; separate from media queues)
 * 2) Best-effort Edge Function notify-by-id (Resend)
 */
export async function submitAppFeedback(input: {
  message: string;
  email?: string;
  category?: AppFeedbackCategory | null;
}): Promise<SubmitAppFeedbackResult> {
  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: 'Please enter your feedback.' };
  }
  if (message.length > 5000) {
    return { ok: false, error: 'Feedback is too long.' };
  }

  const email = input.email?.trim() || null;
  if (email && email.length > 320) {
    return { ok: false, error: 'Email is too long.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email, or leave it blank.' };
  }

  const category = input.category ?? null;

  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      error: 'Feedback is unavailable — Supabase is not configured.',
    };
  }

  const { data, error } = await client.rpc('submit_app_feedback', {
    p_message: message,
    p_email: email,
    p_category: category,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const id = String(data);
  const emailSent = await notifyAppFeedbackOwner(id);
  return { ok: true, id, emailSent };
}
