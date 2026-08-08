/**
 * Pure helpers for Media Admin approve/publish, validation, and audit summaries.
 * Used by tests and mirrored by SQL RPCs / admin-site client.
 */

import {
  cloneMediaBrowseFilter,
  coverageToMediaBrowseFilter,
  isMediaBrowseFilterActive,
} from '@/data/mediaDirectory/mediaBrowse';
import {
  mediaLinkRowHasCoverage,
  mediaLinkRowsToPlatformLinks,
  platformLinksToMediaLinkRows,
  reorderMediaLinkRows,
  validateMediaLinkRows,
  type MediaLinkRow,
  type MediaLinkRowInput,
} from '@/data/mediaDirectory/mediaLinkRows';
import type { MediaPlatformLinks } from '@/data/mediaDirectory/mediaPlatformLinks';

export type MediaAdminAuthGate = {
  configured: boolean;
  hasSession: boolean;
  isAllowlistedAdmin: boolean;
};

export type MediaAdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'not_configured' | 'invalid_credentials' | 'unauthorized' | 'signed_out' };

export function resolveMediaAdminAuthAccess(input: MediaAdminAuthGate): MediaAdminAuthResult {
  if (!input.configured) return { ok: false, reason: 'not_configured' };
  if (!input.hasSession) return { ok: false, reason: 'signed_out' };
  if (!input.isAllowlistedAdmin) return { ok: false, reason: 'unauthorized' };
  return { ok: true, email: 'admin' };
}

export function mediaAdminUnauthorizedMessage(): string {
  return 'This account is not authorized for Media Admin access.';
}

export type MediaAdminSuggestionDraft = {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  links: MediaLinkRow[];
  platformLinks: MediaPlatformLinks;
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  notes?: string | null;
};

export type MediaAdminDraftValidation =
  | { ok: true; value: MediaAdminSuggestionDraft }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateMediaAdminSuggestionDraft(
  input: Partial<MediaAdminSuggestionDraft> & { linkRows?: MediaLinkRowInput[] },
): MediaAdminDraftValidation {
  const fieldErrors: Record<string, string> = {};
  const name = input.name?.trim() ?? '';
  if (!name) fieldErrors.name = 'Creator or podcast name is required.';

  const isNational = Boolean(input.isNational);
  const teamIds = [...new Set((input.teamIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const conferenceIds = [
    ...new Set((input.conferenceIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];

  let linkInput: MediaLinkRowInput[] = [
    ...(input.linkRows ?? input.links ?? platformLinksToMediaLinkRows(input.platformLinks ?? {})),
  ];
  // Admin UI still edits suggestion-level coverage; fan out until per-link admin lands.
  const topLevelCoverage = coverageToMediaBrowseFilter({
    isNational,
    teamIds,
    conferenceIds,
  });
  if (
    !linkInput.some((row) => mediaLinkRowHasCoverage(row)) &&
    isMediaBrowseFilterActive(topLevelCoverage)
  ) {
    linkInput = linkInput.map((row) => ({
      ...row,
      coverage: cloneMediaBrowseFilter(topLevelCoverage),
    }));
  }

  const linksResult = validateMediaLinkRows(linkInput);
  let links: MediaLinkRow[] = [];
  let platformLinks: MediaPlatformLinks = {};
  if (!linksResult.ok) {
    Object.assign(fieldErrors, linksResult.fieldErrors);
  } else {
    links = linksResult.value;
    platformLinks = mediaLinkRowsToPlatformLinks(links);
  }

  const logoUrl = input.logoUrl?.trim() || null;
  if (logoUrl && !isHttpUrl(logoUrl)) {
    fieldErrors.logoUrl = 'Enter a valid artwork URL.';
  }

  if (!isNational && teamIds.length === 0 && conferenceIds.length === 0) {
    fieldErrors.coverage = 'Choose National, at least one team, or a conference.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'Fix the highlighted fields.', fieldErrors };
  }

  return {
    ok: true,
    value: {
      name,
      description: input.description?.trim() || null,
      logoUrl,
      links,
      platformLinks,
      isNational,
      teamIds,
      conferenceIds,
      notes: input.notes?.trim() || null,
    },
  };
}

export { reorderMediaLinkRows };

export type MediaAdminPublishDecision =
  | { ok: true; mode: 'create' }
  | { ok: true; mode: 'update'; existingSourceId: string; confirmOverwrite: true }
  | {
      ok: false;
      reason:
        | 'validation_failed'
        | 'already_published'
        | 'already_reviewed'
        | 'overwrite_confirmation_required'
        | 'unauthorized';
      matches?: Array<{ id: string; name: string }>;
    };

export function decideMediaAdminPublish(input: {
  isAdmin: boolean;
  suggestionStatus: string;
  publishedMediaSourceId: string | null;
  draft: Partial<MediaAdminSuggestionDraft>;
  nameMatches?: Array<{ id: string; name: string }>;
  existingSourceId?: string | null;
  confirmOverwrite?: boolean;
}): MediaAdminPublishDecision {
  if (!input.isAdmin) return { ok: false, reason: 'unauthorized' };
  if (input.suggestionStatus === 'rejected') return { ok: false, reason: 'already_reviewed' };
  if (input.suggestionStatus === 'approved' && input.publishedMediaSourceId) {
    return { ok: false, reason: 'already_published' };
  }

  const validated = validateMediaAdminSuggestionDraft(input.draft);
  if (!validated.ok) return { ok: false, reason: 'validation_failed' };

  if (input.existingSourceId) {
    if (!input.confirmOverwrite) {
      return {
        ok: false,
        reason: 'overwrite_confirmation_required',
        matches: input.nameMatches ?? [],
      };
    }
    return {
      ok: true,
      mode: 'update',
      existingSourceId: input.existingSourceId,
      confirmOverwrite: true,
    };
  }

  const exactMatches = (input.nameMatches ?? []).filter(
    (match) => match.name.trim().toLowerCase() === validated.value.name.toLowerCase(),
  );
  if (exactMatches.length > 0 && !input.confirmOverwrite) {
    return {
      ok: false,
      reason: 'overwrite_confirmation_required',
      matches: exactMatches,
    };
  }

  return { ok: true, mode: 'create' };
}

export function buildMediaAdminAuditSummary(input: {
  action: string;
  entityType: 'suggestion' | 'source' | 'correction';
  entityId: string;
  adminEmail: string | null;
  changedFields: Record<string, unknown>;
}): {
  action: string;
  entityType: 'suggestion' | 'source' | 'correction';
  entityId: string;
  adminEmail: string | null;
  summary: string;
  changedFields: Record<string, unknown>;
} {
  const fieldKeys = Object.keys(input.changedFields);
  const summary =
    fieldKeys.length > 0
      ? `${input.action} (${fieldKeys.join(', ')})`
      : input.action;
  return {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    adminEmail: input.adminEmail,
    summary,
    changedFields: input.changedFields,
  };
}

export function filterMediaAdminSuggestionQueue<
  T extends { name: string; submitterEmail?: string | null; notesPreview?: string | null; status: string },
>(rows: T[], filters: { status?: string | null; search?: string | null }): T[] {
  const status = filters.status ?? null;
  const search = filters.search?.trim().toLowerCase() || null;
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!search) return true;
    const haystack = [row.name, row.submitterEmail ?? '', row.notesPreview ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });
}

export function filterMediaAdminSources<
  T extends {
    name: string;
    isNational: boolean;
    isActive: boolean;
    teamIds: string[];
    conferenceIds: string[];
  },
>(
  rows: T[],
  filters: {
    search?: string | null;
    national?: boolean | null;
    teamId?: string | null;
    conferenceId?: string | null;
    active?: boolean | null;
  },
): T[] {
  const search = filters.search?.trim().toLowerCase() || null;
  return rows.filter((row) => {
    if (search && !row.name.toLowerCase().includes(search)) return false;
    if (typeof filters.national === 'boolean' && row.isNational !== filters.national) return false;
    if (typeof filters.active === 'boolean' && row.isActive !== filters.active) return false;
    if (filters.teamId && !row.teamIds.includes(filters.teamId)) return false;
    if (filters.conferenceId && !row.conferenceIds.includes(filters.conferenceId)) return false;
    return true;
  });
}

export const MEDIA_CORRECTION_TYPES = [
  'wrong_tag',
  'broken_link',
  'updated_artwork',
  'incorrect_description',
  'inactive_creator',
  'other',
] as const;

export type MediaCorrectionType = (typeof MEDIA_CORRECTION_TYPES)[number];
