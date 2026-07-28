import {
  getSupabaseAnonKey,
  getSupabaseClient,
  getSupabaseUrl,
} from '@/data/notifications/supabaseClient';
import { validateMediaSuggestionInput } from '@/data/mediaDirectory/mediaSourceValidation';
import type {
  MediaSourceScope,
  MediaSuggestion,
  MediaSuggestionInput,
  MediaSuggestionProvider,
  MediaSuggestionStatus,
} from '@/data/mediaDirectory/types';

export type SubmitMediaSuggestionResult =
  | { ok: true; id: string; emailSent?: boolean }
  | { ok: false; error: string };

type SuggestionRow = {
  id: string;
  provider: MediaSuggestionProvider;
  submitted_url: string;
  scope: MediaSourceScope;
  conference_id: string | null;
  team_id: string | null;
  notes: string | null;
  status: MediaSuggestionStatus;
  submitted_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  is_national?: boolean | null;
  team_ids?: string[] | null;
  conference_ids?: string[] | null;
};

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mapSuggestion(row: SuggestionRow): MediaSuggestion {
  const teamIds = uniqueIds([...(row.team_ids ?? []), row.team_id]);
  const conferenceIds = uniqueIds([...(row.conference_ids ?? []), row.conference_id]);
  const isNational =
    typeof row.is_national === 'boolean' ? row.is_national : row.scope === 'national';

  return {
    id: row.id,
    provider: row.provider,
    submitted_url: row.submitted_url,
    scope: row.scope,
    conference_id: row.conference_id,
    team_id: row.team_id,
    notes: row.notes,
    status: row.status,
    submitted_by: row.submitted_by,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    isNational,
    teamIds,
    conferenceIds,
  };
}

/**
 * Public FCS Media suggestion.
 * Uses the shared Supabase client / EXPO_PUBLIC_* config (same as the rest of the app).
 * Prefers the edge function (save + owner email); falls back to RPC save when needed.
 * Edge Function / email failures never produce the “not configured” message.
 */
export async function submitMediaSuggestion(
  input: Partial<MediaSuggestionInput>,
): Promise<SubmitMediaSuggestionResult> {
  const validated = validateMediaSuggestionInput(input);
  if (!validated.ok) {
    return { ok: false, error: validated.errors.join(' ') };
  }

  // Same configuration gate as mediaSourcesApi / notifications / admin.
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      error: 'Suggestions are unavailable — Supabase is not configured.',
    };
  }

  const value = validated.value;
  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (baseUrl && anonKey) {
    try {
      const response = await fetch(`${baseUrl}/functions/v1/submit-media-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          provider: value.provider,
          submitted_url: value.submittedUrl,
          is_national: value.isNational,
          conference_ids: value.conferenceIds,
          team_ids: value.teamIds,
          notes: value.notes ?? null,
          coverage_label: value.coverageLabel ?? null,
        }),
      });

      let payload: {
        ok?: boolean;
        id?: string;
        suggestionId?: string;
        emailSent?: boolean;
        error?: string;
      } = {};
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // fall through to RPC
      }

      if (response.ok) {
        const id = payload.id ?? payload.suggestionId;
        if (id) {
          return { ok: true, id: String(id), emailSent: Boolean(payload.emailSent) };
        }
      }

      // Validation errors from the function (not “missing function”)
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 404 &&
        payload.error
      ) {
        return { ok: false, error: payload.error };
      }
    } catch {
      // Network / function unavailable — fall through to shared-client RPC.
    }
  }

  const { data, error } = await client.rpc('submit_media_suggestion', {
    p_provider: value.provider,
    p_submitted_url: value.submittedUrl,
    p_is_national: value.isNational,
    p_conference_ids: value.conferenceIds,
    p_team_ids: value.teamIds,
    p_notes: value.notes ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: String(data), emailSent: false };
}

export async function adminListMediaSuggestions(
  status: MediaSuggestionStatus | null = 'pending',
): Promise<MediaSuggestion[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { data, error } = await client.rpc('admin_list_media_suggestions', {
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SuggestionRow[]).map(mapSuggestion);
}

export async function adminReviewMediaSuggestion(
  id: string,
  status: 'approved' | 'rejected',
  coverage?: {
    isNational: boolean;
    conferenceIds: string[];
    teamIds: string[];
  },
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const payload: Record<string, unknown> = {
    p_id: id,
    p_status: status,
  };

  if (coverage) {
    payload.p_is_national = coverage.isNational;
    payload.p_conference_ids = coverage.conferenceIds;
    payload.p_team_ids = coverage.teamIds;
  }

  const { error } = await client.rpc('admin_review_media_suggestion', payload);
  if (error) throw new Error(error.message);
}
