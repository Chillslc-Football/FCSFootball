import { validateMediaSuggestionInput } from '@/data/mediaDirectory/mediaSourceValidation';
import type {
  MediaSourceScope,
  MediaSuggestion,
  MediaSuggestionInput,
  MediaSuggestionProvider,
  MediaSuggestionStatus,
} from '@/data/mediaDirectory/types';
import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';

export type SubmitMediaSuggestionResult =
  | { ok: true; id: string }
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

export async function submitMediaSuggestion(
  input: Partial<MediaSuggestionInput>,
): Promise<SubmitMediaSuggestionResult> {
  const validated = validateMediaSuggestionInput(input);
  if (!validated.ok) {
    return { ok: false, error: validated.errors.join(' ') };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: 'Suggestions are unavailable — Supabase is not configured.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  const value = validated.value;
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

  return { ok: true, id: String(data) };
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
