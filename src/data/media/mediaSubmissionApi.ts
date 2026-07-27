import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from '@/data/notifications/supabaseClient';
import { validateMediaSubmissionInput } from '@/data/media/mediaValidation';
import type { MediaSubmissionInput } from '@/data/media/types';

export type SubmitMediaResult =
  | { ok: true; submissionId: string; emailSent: boolean }
  | { ok: false; error: string; status?: number };

/**
 * Public creator-first submission through the Edge Function.
 * Never sends email API keys from the client.
 */
export async function submitMediaResource(
  input: Partial<MediaSubmissionInput>,
): Promise<SubmitMediaResult> {
  const validated = validateMediaSubmissionInput(input);
  if (!validated.ok) {
    return { ok: false, error: validated.errors.join(' '), status: 400 };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: 'Submissions are unavailable — Supabase is not configured.',
      status: 503,
    };
  }

  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) {
    return { ok: false, error: 'Supabase is not configured.', status: 503 };
  }

  const value = validated.value;
  const response = await fetch(`${baseUrl}/functions/v1/submit-media-resource`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      submission_type: value.submissionType,
      existing_creator_id: value.existingCreatorId,
      proposed_name: value.proposedName,
      proposed_description: value.proposedDescription,
      scope: value.scope,
      team_id: value.teamId,
      team_name: value.teamName,
      submitter_name: value.submitterName,
      submitter_email: value.submitterEmail,
      submitter_notes: value.submitterNotes,
      links: value.links.map((link) => ({
        link_type: link.linkType,
        url: link.url,
        label: link.label,
      })),
    }),
  });

  let payload: {
    ok?: boolean;
    submissionId?: string;
    emailSent?: boolean;
    error?: string;
  } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // ignore
  }

  if (!response.ok) {
    return {
      ok: false,
      error: payload.error || `Submission failed (HTTP ${response.status})`,
      status: response.status,
    };
  }

  if (!payload.submissionId) {
    return { ok: false, error: 'Submission succeeded without an id.', status: 500 };
  }

  return {
    ok: true,
    submissionId: payload.submissionId,
    emailSent: Boolean(payload.emailSent),
  };
}
