import { getFunctionsBaseUrl, getSupabase } from './supabase';
import type { LinkRow, LinkRowRpc } from './catalog';

export type SuggestionQueueItem = {
  id: string;
  name: string;
  submitterEmail: string | null;
  submittedAt: string;
  status: string;
  isNational: boolean;
  teams: string[];
  teamIds: string[];
  conferences: string[];
  conferenceIds: string[];
  platformCount: number;
  notesPreview: string | null;
  publishedMediaSourceId: string | null;
  reviewedAt: string | null;
};

export type SuggestionDetail = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  links: LinkRow[];
  platformLinks: Record<string, string>;
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  coverageLabels: {
    teams?: Record<string, string>;
    conferences?: Record<string, string>;
  };
  submitterEmail: string | null;
  notes: string | null;
  adminNotes: string | null;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedMediaSourceId: string | null;
  outcomeNotifiedAt: string | null;
};

export type SourceDetail = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  logoUrl: string | null;
  links: LinkRow[];
  platformLinks: Record<string, string>;
  isNational: boolean;
  isApproved: boolean;
  isActive: boolean;
  displayOrder: number;
  teamIds: string[];
  conferenceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CorrectionListItem = {
  id: string;
  mediaSourceId: string | null;
  creatorName: string | null;
  correctionType: string;
  details: string | null;
  submitterEmail: string | null;
  status: string;
  createdAt: string;
  proposedSummary: string | null;
};

export type CorrectionDetail = {
  id: string;
  mediaSourceId: string | null;
  correctionType: string;
  proposedChanges: Record<string, unknown>;
  details: string | null;
  submitterEmail: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  source: SourceDetail | null;
};

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeSourceDetail(raw: unknown): SourceDetail {
  const data = asRecord(raw);
  return {
    id: String(data.id ?? ''),
    name: String(data.name ?? ''),
    subtitle: (data.subtitle as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    logoUrl: (data.logoUrl as string | null) ?? null,
    links: Array.isArray(data.links) ? (data.links as LinkRow[]) : [],
    platformLinks:
      data.platformLinks && typeof data.platformLinks === 'object'
        ? (data.platformLinks as Record<string, string>)
        : {},
    isNational: Boolean(data.isNational),
    isApproved: Boolean(data.isApproved),
    isActive: data.isActive !== false,
    displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
    teamIds: asStringArray(data.teamIds),
    conferenceIds: asStringArray(data.conferenceIds),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  };
}

function normalizeSuggestionDetail(raw: unknown): SuggestionDetail {
  const data = asRecord(raw);
  return {
    id: String(data.id ?? ''),
    name: String(data.name ?? ''),
    description: (data.description as string | null) ?? null,
    logoUrl: (data.logoUrl as string | null) ?? null,
    links: Array.isArray(data.links) ? (data.links as LinkRow[]) : [],
    platformLinks:
      data.platformLinks && typeof data.platformLinks === 'object'
        ? (data.platformLinks as Record<string, string>)
        : {},
    isNational: Boolean(data.isNational),
    teamIds: asStringArray(data.teamIds),
    conferenceIds: asStringArray(data.conferenceIds),
    coverageLabels:
      data.coverageLabels && typeof data.coverageLabels === 'object'
        ? (data.coverageLabels as SuggestionDetail['coverageLabels'])
        : {},
    submitterEmail: (data.submitterEmail as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    adminNotes: (data.adminNotes as string | null) ?? null,
    status: String(data.status ?? ''),
    submittedAt: String(data.submittedAt ?? ''),
    reviewedAt: (data.reviewedAt as string | null) ?? null,
    reviewedBy: (data.reviewedBy as string | null) ?? null,
    publishedMediaSourceId: (data.publishedMediaSourceId as string | null) ?? null,
    outcomeNotifiedAt: (data.outcomeNotifiedAt as string | null) ?? null,
  };
}

export async function checkIsAppAdmin(): Promise<boolean> {
  try {
    return Boolean(await rpc<boolean>('is_app_admin'));
  } catch {
    return false;
  }
}

export async function listSuggestionQueue(input: {
  status: string | null;
  search: string;
}): Promise<SuggestionQueueItem[]> {
  const data = await rpc<SuggestionQueueItem[]>('admin_list_media_suggestion_queue', {
    p_status: input.status,
    p_search: input.search.trim() || null,
  });
  return Array.isArray(data) ? data : [];
}

export async function getSuggestionDetail(id: string): Promise<SuggestionDetail> {
  return normalizeSuggestionDetail(
    await rpc<unknown>('admin_get_media_suggestion_detail', { p_id: id }),
  );
}

export async function saveSuggestionDraft(input: {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  links: LinkRowRpc[];
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  /** Pass null to preserve original submitter notes. */
  notes?: string | null;
  adminNotes?: string | null;
  coverageLabels?: Record<string, unknown> | null;
}): Promise<SuggestionDetail> {
  return normalizeSuggestionDetail(
    await rpc<unknown>('admin_update_media_suggestion_draft', {
      p_id: input.id,
      p_name: input.name,
      p_description: input.description,
      p_logo_url: input.logoUrl,
      p_links: input.links,
      p_platform_links: null,
      p_is_national: input.isNational,
      p_team_ids: input.teamIds,
      p_conference_ids: input.conferenceIds,
      p_notes: input.notes === undefined ? null : input.notes,
      p_admin_notes: input.adminNotes === undefined ? null : input.adminNotes,
      p_coverage_labels: input.coverageLabels ?? null,
    }),
  );
}

export type SourceMatchCandidate = {
  id: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  isApproved: boolean;
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  links: LinkRow[];
  score: number;
  reasons: string[];
};

export async function findSourceMatches(input: {
  name: string;
  urls?: string[];
}): Promise<SourceMatchCandidate[]> {
  const data = await rpc<unknown>('admin_find_media_source_matches', {
    p_name: input.name,
    p_urls: input.urls ?? [],
  });
  const rows = Array.isArray(data) ? data : [];
  return rows.map((item) => {
    const row = asRecord(item);
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      logoUrl: (row.logoUrl as string | null) ?? null,
      isActive: row.isActive !== false,
      isApproved: Boolean(row.isApproved),
      isNational: Boolean(row.isNational),
      teamIds: asStringArray(row.teamIds),
      conferenceIds: asStringArray(row.conferenceIds),
      links: Array.isArray(row.links) ? (row.links as LinkRow[]) : [],
      score: typeof row.score === 'number' ? row.score : Number(row.score) || 0,
      reasons: asStringArray(row.reasons),
    };
  });
}

export async function approveAndPublish(input: {
  id: string;
  existingSourceId?: string | null;
  confirmOverwrite?: boolean;
}) {
  return rpc<{
    ok: boolean;
    suggestionId: string;
    mediaSourceId: string;
    mode: string;
    status: string;
  }>('admin_approve_and_publish_media_suggestion', {
    p_id: input.id,
    p_existing_source_id: input.existingSourceId ?? null,
    p_confirm_overwrite: Boolean(input.confirmOverwrite),
  });
}

export async function rejectSuggestion(id: string, adminNotes?: string | null) {
  return rpc<{ ok: boolean; suggestionId: string; status: string }>(
    'admin_reject_media_suggestion',
    {
      p_id: id,
      p_admin_notes: adminNotes ?? null,
    },
  );
}

export async function mergeSuggestion(input: {
  id: string;
  existingSourceId: string;
  copyLinks: boolean;
  copyArtwork: boolean;
  copyDescription: boolean;
  copyTeams: boolean;
  copyConferences: boolean;
  copyNational: boolean;
}) {
  return rpc<{
    ok: boolean;
    suggestionId: string;
    mediaSourceId: string;
    mode: string;
    status: string;
    addedLinks: number;
  }>('admin_merge_media_suggestion', {
    p_id: input.id,
    p_existing_source_id: input.existingSourceId,
    p_copy_links: input.copyLinks,
    p_copy_artwork: input.copyArtwork,
    p_copy_description: input.copyDescription,
    p_copy_teams: input.copyTeams,
    p_copy_conferences: input.copyConferences,
    p_copy_national: input.copyNational,
  });
}

export async function notifySuggestionOutcome(input: {
  suggestionId: string;
  outcome: 'approved' | 'rejected';
  notify?: boolean;
}): Promise<{ submitterNotified: boolean }> {
  const session = await getSupabase().auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const response = await fetch(`${getFunctionsBaseUrl()}/admin-media-notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      suggestion_id: input.suggestionId,
      outcome: input.outcome,
      notify: input.notify !== false,
    }),
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    submitterNotified?: boolean;
    error?: string;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Failed to notify submitter');
  }
  return { submitterNotified: Boolean(payload.submitterNotified) };
}

export async function listSources(input: {
  search: string;
  national: boolean | null;
  teamId: string | null;
  conferenceId: string | null;
  active: boolean | null;
}): Promise<SourceDetail[]> {
  const data = await rpc<unknown[]>('admin_list_media_sources', {
    p_search: input.search.trim() || null,
    p_national: input.national,
    p_team_id: input.teamId,
    p_conference_id: input.conferenceId,
    p_active: input.active,
  });
  return Array.isArray(data) ? data.map(normalizeSourceDetail) : [];
}

export async function getSourceDetail(id: string): Promise<SourceDetail> {
  return normalizeSourceDetail(await rpc<unknown>('admin_get_media_source_detail', { p_id: id }));
}

export async function upsertSource(input: {
  id?: string | null;
  name: string;
  description: string | null;
  logoUrl: string | null;
  links: LinkRowRpc[];
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  isActive: boolean;
  isApproved?: boolean;
}): Promise<SourceDetail> {
  return normalizeSourceDetail(
    await rpc<unknown>('admin_upsert_media_source', {
      p_id: input.id ?? null,
      p_name: input.name,
      p_description: input.description,
      p_logo_url: input.logoUrl,
      p_links: input.links,
      p_platform_links: null,
      p_is_national: input.isNational,
      p_team_ids: input.teamIds,
      p_conference_ids: input.conferenceIds,
      p_is_active: input.isActive,
      p_is_approved: input.isApproved ?? true,
    }),
  );
}

export async function listCorrections(status = 'pending'): Promise<CorrectionListItem[]> {
  const data = await rpc<unknown[]>('admin_list_media_corrections', { p_status: status });
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const row = asRecord(item);
    return {
      id: String(row.id ?? ''),
      mediaSourceId: (row.mediaSourceId as string | null) ?? null,
      creatorName: (row.creatorName as string | null) ?? null,
      correctionType: String(row.correctionType ?? ''),
      details: (row.details as string | null) ?? null,
      submitterEmail: (row.submitterEmail as string | null) ?? null,
      status: String(row.status ?? ''),
      createdAt: String(row.createdAt ?? ''),
      proposedSummary: (row.proposedSummary as string | null) ?? null,
    };
  });
}

export async function getCorrectionDetail(id: string): Promise<CorrectionDetail> {
  const data = asRecord(await rpc<unknown>('admin_get_media_correction_detail', { p_id: id }));
  return {
    id: String(data.id ?? ''),
    mediaSourceId: (data.mediaSourceId as string | null) ?? null,
    correctionType: String(data.correctionType ?? ''),
    proposedChanges: asRecord(data.proposedChanges),
    details: (data.details as string | null) ?? null,
    submitterEmail: (data.submitterEmail as string | null) ?? null,
    status: String(data.status ?? ''),
    adminNotes: (data.adminNotes as string | null) ?? null,
    createdAt: String(data.createdAt ?? ''),
    reviewedAt: (data.reviewedAt as string | null) ?? null,
    source: data.source ? normalizeSourceDetail(data.source) : null,
  };
}

export async function applyCorrection(input: {
  id: string;
  links?: LinkRowRpc[] | null;
  isNational?: boolean | null;
  teamIds?: string[] | null;
  conferenceIds?: string[] | null;
  name?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  isActive?: boolean | null;
  adminNotes?: string | null;
}) {
  return rpc<{
    ok: boolean;
    status: string;
    mediaSourceId: string;
    linkCount: number;
  }>('admin_apply_media_correction', {
    p_id: input.id,
    p_links: input.links ?? null,
    p_is_national: input.isNational ?? null,
    p_team_ids: input.teamIds ?? null,
    p_conference_ids: input.conferenceIds ?? null,
    p_name: input.name ?? null,
    p_description: input.description ?? null,
    p_logo_url: input.logoUrl ?? null,
    p_is_active: input.isActive ?? null,
    p_admin_notes: input.adminNotes ?? null,
  });
}

export async function rejectCorrection(id: string, adminNotes?: string | null) {
  return rpc<{ ok: boolean; status: string }>('admin_reject_media_correction', {
    p_id: id,
    p_admin_notes: adminNotes ?? null,
  });
}

export function buildReplyMailto(email: string, creatorName: string): string {
  const subject = 'Question about your FCS Pulse media suggestion';
  const body = [
    'Hi,',
    '',
    `Thanks for suggesting ${creatorName} for FCS Pulse.`,
    '',
    'I have a quick question:',
    '',
  ].join('\n');
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildCorrectionReplyMailto(email: string, creatorName: string): string {
  const subject = 'Question about your FCS Pulse media correction';
  const body = [
    'Hi,',
    '',
    `Thanks for reporting an issue with ${creatorName} on FCS Pulse.`,
    '',
    'I have a quick question:',
    '',
  ].join('\n');
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
