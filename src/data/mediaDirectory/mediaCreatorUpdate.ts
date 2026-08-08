/**
 * Validation + RPC payload for "Update Your Creator Page".
 * Queues media_correction_suggestions; never writes live media_sources.
 */

import {
  cloneMediaBrowseFilter,
  coverageToMediaBrowseFilter,
  isMediaBrowseFilterActive,
  type MediaBrowseFilter,
} from '@/data/mediaDirectory/mediaBrowse';
import {
  getSuggestLinkUrlHostKey,
} from '@/data/mediaDirectory/mediaLinkUrlDetection';
import {
  createEmptyMediaLinkRow,
  mediaLinkRowsToPlatformLinks,
  mediaLinkRowsToRpcJson,
  unionMediaLinkRowCoverage,
  validateMediaLinkRows,
  type MediaLinkRow,
  type MediaLinkRowInput,
} from '@/data/mediaDirectory/mediaLinkRows';
import {
  isValidSubmitterEmail,
  normalizeSubmitterEmail,
} from '@/data/mediaDirectory/mediaSuggestionNotifyEmail';
import type { MediaSuggestionCoverageLabels } from '@/data/mediaDirectory/mediaSuggestionCoverageLabels';
import type { MediaSource } from '@/data/mediaDirectory/types';

export type MediaCreatorUpdateFieldErrors = Partial<
  Record<'submitterEmail' | 'description' | 'links' | 'representsCreator' | string, string>
>;

export type MediaCreatorUpdateInput = {
  mediaSourceId: string;
  creatorName: string;
  description: string | null;
  links: MediaLinkRow[];
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  submitterEmail: string;
  notes: string | null;
  representsCreator: boolean;
  coverageLabels?: MediaSuggestionCoverageLabels | null;
};

export type MediaCreatorUpdateValidationResult =
  | { ok: true; value: MediaCreatorUpdateInput }
  | { ok: false; errors: string[]; fieldErrors: MediaCreatorUpdateFieldErrors };

export type SubmitMediaCreatorUpdateRpcPayload = {
  p_media_source_id: string;
  p_description: string | null;
  p_links: ReturnType<typeof mediaLinkRowsToRpcJson>;
  p_is_national: boolean;
  p_conference_ids: string[];
  p_team_ids: string[];
  p_submitter_email: string;
  p_notes: string | null;
  p_represents_creator: boolean;
  p_coverage_labels: MediaSuggestionCoverageLabels;
};

/** Prefill compact link editor rows from an approved media source. */
export function mediaSourceToUpdateLinkRows(source: MediaSource): MediaLinkRowInput[] {
  const parentCoverage = coverageToMediaBrowseFilter({
    isNational: source.isNational,
    teamIds: source.teamIds,
    conferenceIds: source.conferenceIds,
  });

  if (!source.links.length) {
    return [createEmptyMediaLinkRow(0, parentCoverage)];
  }

  return source.links.map((link, index) => {
    const fromLink = coverageToMediaBrowseFilter({
      isNational: Boolean(link.isNational),
      teamIds: link.teamIds ?? [],
      conferenceIds: link.conferenceIds ?? [],
    });
    const coverage: MediaBrowseFilter = isMediaBrowseFilterActive(fromLink)
      ? fromLink
      : cloneMediaBrowseFilter(parentCoverage);
    const url = link.url ?? '';
    return {
      id: link.id ?? null,
      platform: link.platform,
      label: link.label ?? '',
      url,
      sortOrder: index,
      platformManual: true,
      platformManualHostKey: getSuggestLinkUrlHostKey(url) || null,
      coverage,
    };
  });
}

export function validateMediaCreatorUpdateInput(input: {
  mediaSourceId?: string | null;
  creatorName?: string | null;
  description?: string | null;
  submitterEmail?: string | null;
  notes?: string | null;
  representsCreator?: boolean | null;
  linkRows?: MediaLinkRowInput[];
  coverageLabels?: MediaSuggestionCoverageLabels | null;
}): MediaCreatorUpdateValidationResult {
  const errors: string[] = [];
  const fieldErrors: MediaCreatorUpdateFieldErrors = {};

  const mediaSourceId = String(input.mediaSourceId ?? '').trim();
  const creatorName = String(input.creatorName ?? '').trim() || 'Creator';
  const description = input.description?.trim() || null;
  const notes = input.notes?.trim() || null;
  const submitterEmail = normalizeSubmitterEmail(input.submitterEmail ?? '');
  const representsCreator = Boolean(input.representsCreator);

  if (!mediaSourceId) {
    const message = 'Creator is missing.';
    errors.push(message);
  }

  if (!submitterEmail) {
    const message = 'Email is required.';
    fieldErrors.submitterEmail = message;
    errors.push(message);
  } else if (!isValidSubmitterEmail(submitterEmail)) {
    const message = 'Enter a valid email address.';
    fieldErrors.submitterEmail = message;
    errors.push(message);
  }

  if (!representsCreator) {
    const message = 'Confirm that you represent this creator.';
    fieldErrors.representsCreator = message;
    errors.push(message);
  }

  const linksResult = validateMediaLinkRows(input.linkRows ?? []);
  let links: MediaLinkRow[] = [];
  if (!linksResult.ok) {
    Object.assign(fieldErrors, linksResult.fieldErrors);
    errors.push(linksResult.error);
  } else {
    links = linksResult.value;
  }

  if (errors.length > 0) {
    return { ok: false, errors, fieldErrors };
  }

  const union = unionMediaLinkRowCoverage(links);
  return {
    ok: true,
    value: {
      mediaSourceId,
      creatorName,
      description,
      links,
      isNational: union.isNational,
      teamIds: union.teamIds,
      conferenceIds: union.conferenceIds,
      submitterEmail,
      notes,
      representsCreator: true,
      coverageLabels: input.coverageLabels ?? { teams: {}, conferences: {} },
    },
  };
}

export function buildSubmitMediaCreatorUpdateRpcPayload(
  value: MediaCreatorUpdateInput,
): SubmitMediaCreatorUpdateRpcPayload {
  return {
    p_media_source_id: value.mediaSourceId,
    p_description: value.description,
    p_links: mediaLinkRowsToRpcJson(value.links),
    p_is_national: value.isNational,
    p_conference_ids: value.conferenceIds,
    p_team_ids: value.teamIds,
    p_submitter_email: value.submitterEmail,
    p_notes: value.notes,
    p_represents_creator: value.representsCreator,
    p_coverage_labels: value.coverageLabels ?? { teams: {}, conferences: {} },
  };
}

/** Kept for tests / email helpers; platform map is not the submission source of truth. */
export function mediaCreatorUpdatePlatformLinks(value: MediaCreatorUpdateInput) {
  return mediaLinkRowsToPlatformLinks(value.links);
}
