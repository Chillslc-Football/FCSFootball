import { getSupabaseClient } from '@/data/notifications/supabaseClient';
import type {
  MediaResourceType,
  MediaSubmissionDetail,
  MediaSubmissionRow,
  MediaSubmissionStatus,
} from '@/data/media/types';

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured.');
  }
  return client;
}

export async function checkIsAppAdmin(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { data, error } = await client.rpc('is_app_admin');
  if (error) {
    console.warn('[mediaAdminApi] is_app_admin failed:', error.message);
    return false;
  }
  return Boolean(data);
}

export async function adminListMediaSubmissions(filters?: {
  status?: MediaSubmissionStatus | null;
  teamId?: string | null;
  resourceType?: MediaResourceType | null;
  search?: string | null;
}): Promise<MediaSubmissionRow[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_list_media_submissions', {
    p_status: filters?.status ?? null,
    p_team_id: filters?.teamId ?? null,
    p_resource_type: filters?.resourceType ?? null,
    p_search: filters?.search?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaSubmissionRow[];
}

export async function adminGetMediaSubmission(id: string): Promise<MediaSubmissionDetail> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_get_media_submission', { p_id: id });
  if (error) throw new Error(error.message);
  const payload = data as MediaSubmissionDetail;
  return {
    submission: payload.submission,
    links: Array.isArray(payload.links) ? payload.links : [],
  };
}

export async function adminUpdateMediaSubmission(
  id: string,
  patch: {
    submittedName?: string;
    scope?: string;
    teamId?: string | null;
    teamName?: string | null;
    resourceType?: string;
    submittedUrl?: string;
    description?: string | null;
    adminNotes?: string | null;
  },
): Promise<MediaSubmissionRow> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_update_media_submission', {
    p_id: id,
    p_submitted_name: patch.submittedName ?? null,
    p_scope: patch.scope ?? null,
    p_team_id: patch.teamId === undefined ? null : patch.teamId,
    p_team_name: patch.teamName === undefined ? null : patch.teamName,
    p_resource_type: patch.resourceType ?? null,
    p_submitted_url: patch.submittedUrl ?? null,
    p_description: patch.description === undefined ? null : patch.description,
    p_admin_notes: patch.adminNotes === undefined ? null : patch.adminNotes,
  });
  if (error) throw new Error(error.message);
  return data as MediaSubmissionRow;
}

export async function adminApproveMediaSubmission(
  id: string,
  adminNotes?: string | null,
): Promise<MediaSubmissionRow> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_approve_media_submission', {
    p_id: id,
    p_admin_notes: adminNotes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as MediaSubmissionRow;
}

export async function adminRejectMediaSubmission(
  id: string,
  adminNotes?: string | null,
): Promise<MediaSubmissionRow> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_reject_media_submission', {
    p_id: id,
    p_admin_notes: adminNotes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as MediaSubmissionRow;
}

export async function adminSetMediaCreatorStatus(
  creatorId: string,
  status: 'active' | 'inactive',
): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_set_media_creator_status', {
    p_creator_id: creatorId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}
