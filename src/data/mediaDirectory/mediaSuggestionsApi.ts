import {
  getSupabaseAnonKey,
  getSupabaseClient,
  getSupabaseUrl,
} from '@/data/notifications/supabaseClient';
import { normalizeMediaPlatformLinks } from '@/data/mediaDirectory/mediaPlatformLinks';
import { buildMediaSuggestionNotifyPayload } from '@/data/mediaDirectory/mediaSuggestionNotifyEmail';
import type { MediaLinkRowInput } from '@/data/mediaDirectory/mediaLinkRows';
import {
  buildSubmitMediaSuggestionRpcPayload,
  isLegacyMediaSuggestionProviderError,
  type MediaSuggestionFieldErrors,
  validateMediaSuggestionInput,
} from '@/data/mediaDirectory/mediaSourceValidation';
import type {
  MediaSourceScope,
  MediaSuggestion,
  MediaSuggestionInput,
  MediaSuggestionStatus,
} from '@/data/mediaDirectory/types';

export type SubmitMediaSuggestionResult =
  | { ok: true; id: string; emailSent?: boolean }
  | { ok: false; error: string; fieldErrors?: MediaSuggestionFieldErrors };

export type SubmitMediaSuggestionClientInput = Partial<MediaSuggestionInput> & {
  linkRows?: MediaLinkRowInput[];
};

type SuggestionRow = {
  id: string;
  name?: string | null;
  provider: string;
  submitted_url: string;
  platform_links?: Record<string, string> | null;
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
  const platformLinks = normalizeMediaPlatformLinks(
    (row.platform_links as Record<string, string> | null | undefined) ??
      (row.provider && row.submitted_url
        ? { [row.provider]: row.submitted_url }
        : {}),
  );

  return {
    id: row.id,
    name: row.name?.trim() || null,
    provider: row.provider,
    submitted_url: row.submitted_url,
    platformLinks,
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
 * Ask the Edge Function to email the owner from the saved suggestion row.
 * Failures are logged server-side; the client always treats notify as best-effort.
 */
async function notifyMediaSuggestionOwner(
  suggestionId: string,
  coverageLabels?: MediaSuggestionInput['coverageLabels'],
): Promise<boolean> {
  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) return false;

  try {
    const response = await fetch(`${baseUrl}/functions/v1/submit-media-suggestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify(
        buildMediaSuggestionNotifyPayload(suggestionId, coverageLabels ?? null),
      ),
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
 * Public FCS Media suggestion.
 * 1) Save via RPC (source of truth)
 * 2) Best-effort Edge Function notify-by-id (Resend), never failing the save
 */
export async function submitMediaSuggestion(
  input: SubmitMediaSuggestionClientInput,
): Promise<SubmitMediaSuggestionResult> {
  const validated = validateMediaSuggestionInput(input);
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
      error: 'Suggestions are unavailable — Supabase is not configured.',
    };
  }

  const value = validated.value;
  const { data, error } = await client.rpc(
    'submit_media_suggestion',
    buildSubmitMediaSuggestionRpcPayload(value),
  );

  if (error) {
    if (isLegacyMediaSuggestionProviderError(error.message)) {
      return {
        ok: false,
        error: '',
        fieldErrors: { links: 'Add at least one link.' },
      };
    }
    return { ok: false, error: error.message };
  }

  const id = String(data);
  const emailSent = await notifyMediaSuggestionOwner(id, value.coverageLabels);
  return { ok: true, id, emailSent };
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
