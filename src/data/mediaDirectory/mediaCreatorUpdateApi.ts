import {
  buildSubmitMediaCreatorUpdateRpcPayload,
  validateMediaCreatorUpdateInput,
  type MediaCreatorUpdateFieldErrors,
} from '@/data/mediaDirectory/mediaCreatorUpdate';
import type { MediaLinkRowInput } from '@/data/mediaDirectory/mediaLinkRows';
import type { MediaSuggestionCoverageLabels } from '@/data/mediaDirectory/mediaSuggestionCoverageLabels';
import {
  getSupabaseAnonKey,
  getSupabaseClient,
  getSupabaseUrl,
} from '@/data/notifications/supabaseClient';

export type SubmitMediaCreatorUpdateResult =
  | { ok: true; id: string; emailSent?: boolean }
  | { ok: false; error: string; fieldErrors?: MediaCreatorUpdateFieldErrors };

export type SubmitMediaCreatorUpdateClientInput = {
  mediaSourceId: string;
  creatorName: string;
  description?: string | null;
  submitterEmail: string;
  notes?: string | null;
  representsCreator: boolean;
  linkRows: MediaLinkRowInput[];
  coverageLabels?: MediaSuggestionCoverageLabels | null;
};

async function notifyMediaCreatorUpdateOwner(correctionId: string): Promise<boolean> {
  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) return false;

  try {
    const response = await fetch(`${baseUrl}/functions/v1/submit-media-creator-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ correction_id: correctionId.trim() }),
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
 * Public creator-page update.
 * 1) Save via RPC into media_correction_suggestions (pending)
 * 2) Best-effort owner email — never fails the save
 */
export async function submitMediaCreatorUpdate(
  input: SubmitMediaCreatorUpdateClientInput,
): Promise<SubmitMediaCreatorUpdateResult> {
  const validated = validateMediaCreatorUpdateInput(input);
  if (!validated.ok) {
    return {
      ok: false,
      error: '',
      fieldErrors: validated.fieldErrors,
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      error: 'Updates are unavailable — Supabase is not configured.',
    };
  }

  const value = validated.value;
  const { data, error } = await client.rpc(
    'submit_media_creator_update',
    buildSubmitMediaCreatorUpdateRpcPayload(value),
  );

  if (error) {
    const message = error.message || 'Submission failed.';
    // Match the RPC exception exactly — do not treat unrelated messages that merely
    // mention p_submitter_email (e.g. schema-cache / signature errors) as invalid email.
    if (/submitter_email_required/i.test(message)) {
      const email = String(value.submitterEmail ?? '').trim();
      return {
        ok: false,
        error: '',
        fieldErrors: {
          submitterEmail: email
            ? 'Enter a valid email address.'
            : 'Email is required.',
        },
      };
    }
    if (/represents_creator_required/i.test(message)) {
      return {
        ok: false,
        error: '',
        fieldErrors: { representsCreator: 'Confirm that you represent this creator.' },
      };
    }
    if (/media_source_not_found|media_source_required/i.test(message)) {
      return { ok: false, error: 'This creator is unavailable for updates.' };
    }
    return { ok: false, error: message };
  }

  const id = String(data);
  const emailSent = await notifyMediaCreatorUpdateOwner(id);
  return { ok: true, id, emailSent };
}
