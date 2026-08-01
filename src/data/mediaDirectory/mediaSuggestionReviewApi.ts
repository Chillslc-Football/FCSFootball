/** Shared review API helpers (static site + Edge Function contracts). */

import {
  resolveMediaSuggestionConferenceNames,
  resolveMediaSuggestionTeamNames,
  type MediaSuggestionCoverageLabels,
} from '@/data/mediaDirectory/mediaSuggestionCoverageLabels';

export const MEDIA_SUGGESTION_REVIEW_SITE_ORIGIN = 'https://fcspulse.com';

export const MEDIA_SUGGESTION_REVIEW_ALLOWED_ORIGINS = [
  MEDIA_SUGGESTION_REVIEW_SITE_ORIGIN,
  'http://localhost:4173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
] as const;

export const MEDIA_SUGGESTION_REVIEW_JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

export type MediaSuggestionReviewAction = 'approve' | 'reject';

export type MediaSuggestionReviewDto = {
  id: string;
  name: string;
  status: string;
  platformLinks: Record<string, string>;
  isNational: boolean;
  teams: string[];
  conferences: string[];
  notes: string | null;
  submitterEmail: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type MediaSuggestionReviewGetSuccess = {
  ok: true;
  suggestion: MediaSuggestionReviewDto;
};

export type MediaSuggestionReviewGetError = {
  ok: false;
  error: 'invalid_token' | 'expired_token' | 'not_found' | 'forbidden';
  message: string;
};

export type MediaSuggestionReviewPostSuccess = {
  ok: true;
  status: 'approved' | 'rejected';
  submitterNotified: boolean;
};

export type MediaSuggestionReviewPostError = {
  ok: false;
  error:
    | 'invalid_token'
    | 'expired_token'
    | 'already_reviewed'
    | 'invalid_action'
    | 'not_found'
    | 'forbidden';
  message: string;
};

export type MediaSuggestionReviewGetResponse =
  | MediaSuggestionReviewGetSuccess
  | MediaSuggestionReviewGetError;

export type MediaSuggestionReviewPostResponse =
  | MediaSuggestionReviewPostSuccess
  | MediaSuggestionReviewPostError;

export function isAllowedMediaSuggestionReviewOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  const trimmed = origin.trim().replace(/\/$/, '');
  return (MEDIA_SUGGESTION_REVIEW_ALLOWED_ORIGINS as readonly string[]).includes(trimmed);
}

export function buildMediaSuggestionReviewCorsHeaders(
  origin: string | null | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
    'Content-Type': MEDIA_SUGGESTION_REVIEW_JSON_CONTENT_TYPE,
    'Cache-Control': 'no-store',
  };
  if (isAllowedMediaSuggestionReviewOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!.trim().replace(/\/$/, '');
  }
  return headers;
}

/** Build a JSON Response matching the Edge Function contract (for tests). */
export function createMediaSuggestionReviewJsonResponse(
  body: unknown,
  status: number,
  origin: string | null | undefined,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildMediaSuggestionReviewCorsHeaders(origin),
  });
}

export function isMediaSuggestionReviewJsonContentType(
  contentType: string | null | undefined,
): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes('application/json') &&
    !normalized.includes('text/html') &&
    !normalized.includes('text/plain')
  );
}

export function buildMediaSuggestionReviewPageUrl(input: {
  siteOrigin?: string;
  token: string;
  action?: MediaSuggestionReviewAction | null;
}): string {
  const origin = (input.siteOrigin ?? MEDIA_SUGGESTION_REVIEW_SITE_ORIGIN).replace(/\/$/, '');
  const url = new URL(`${origin}/review`);
  url.searchParams.set('token', input.token);
  if (input.action === 'approve' || input.action === 'reject') {
    url.searchParams.set('action', input.action);
  }
  return url.toString();
}

export function buildMediaSuggestionReviewDto(input: {
  id: string;
  name: string;
  status: string;
  platformLinks: Record<string, string>;
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  coverageLabels?: MediaSuggestionCoverageLabels | null;
  notes: string | null;
  submitterEmail: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}): MediaSuggestionReviewDto {
  return {
    id: input.id,
    name: input.name.trim() || 'Untitled',
    status: input.status,
    platformLinks: input.platformLinks,
    isNational: input.isNational,
    teams: resolveMediaSuggestionTeamNames(input.teamIds, input.coverageLabels),
    conferences: resolveMediaSuggestionConferenceNames(
      input.conferenceIds,
      input.coverageLabels,
    ),
    notes: input.notes,
    submitterEmail: input.submitterEmail?.trim().toLowerCase() || null,
    submittedAt: input.submittedAt,
    reviewedAt: input.reviewedAt ?? null,
  };
}

export function buildMediaSuggestionReviewGetSuccess(
  suggestion: MediaSuggestionReviewDto,
): MediaSuggestionReviewGetSuccess {
  return { ok: true, suggestion };
}

export function buildMediaSuggestionReviewGetError(
  error: MediaSuggestionReviewGetError['error'],
): MediaSuggestionReviewGetError {
  return { ok: false, error, message: friendlyMediaSuggestionReviewError(error) };
}

export function buildMediaSuggestionReviewPostSuccess(input: {
  status: 'approved' | 'rejected';
  submitterNotified: boolean;
}): MediaSuggestionReviewPostSuccess {
  return {
    ok: true,
    status: input.status,
    submitterNotified: input.submitterNotified,
  };
}

export function buildMediaSuggestionReviewPostError(
  error: MediaSuggestionReviewPostError['error'],
): MediaSuggestionReviewPostError {
  return { ok: false, error, message: friendlyMediaSuggestionReviewError(error) };
}

/** UI copy for static review page result states (not Edge Function HTML). */
export function buildMediaSuggestionReviewPageCopy(
  state: 'approved' | 'rejected' | 'already_reviewed' | 'invalid_token' | 'expired_token',
): { heading: string; detail: string } {
  switch (state) {
    case 'approved':
      return {
        heading: 'Suggestion Approved',
        detail: 'The submitter has been notified.',
      };
    case 'rejected':
      return {
        heading: 'Suggestion Rejected',
        detail: 'The submitter has been notified.',
      };
    case 'already_reviewed':
      return {
        heading: 'Already reviewed',
        detail: 'This suggestion was already reviewed.',
      };
    case 'expired_token':
      return {
        heading: 'Unable to open review',
        detail: friendlyMediaSuggestionReviewError('expired_token'),
      };
    case 'invalid_token':
    default:
      return {
        heading: 'Unable to open review',
        detail: friendlyMediaSuggestionReviewError('invalid_token'),
      };
  }
}

export function friendlyMediaSuggestionReviewError(
  code: MediaSuggestionReviewGetError['error'] | MediaSuggestionReviewPostError['error'],
): string {
  switch (code) {
    case 'expired_token':
      return 'This review link has expired.';
    case 'already_reviewed':
      return 'This suggestion was already reviewed.';
    case 'invalid_action':
      return 'That review action is not valid.';
    case 'not_found':
      return 'This suggestion could not be found.';
    case 'forbidden':
      return 'This request is not allowed.';
    case 'invalid_token':
    default:
      return 'This review link is invalid.';
  }
}
