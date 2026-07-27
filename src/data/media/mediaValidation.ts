import {
  MEDIA_RESOURCE_TYPES,
  MEDIA_SCOPES,
  MEDIA_SUBMISSION_TYPES,
  type MediaLinkInput,
  type MediaResourceType,
  type MediaScope,
  type MediaSubmissionInput,
  type MediaSubmissionType,
  type PublicMediaCreator,
} from '@/data/media/types';

export type MediaValidationResult =
  | { ok: true; value: MediaSubmissionInput }
  | { ok: false; errors: string[] };

/** Normalize URL for duplicate comparison (host + path, no scheme/www/trailing slash). */
export function normalizeMediaUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().toLowerCase();
  return trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

export function isValidHttpUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidOptionalEmail(raw: string | null | undefined): boolean {
  const value = raw?.trim() ?? '';
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isMediaResourceType(value: string): value is MediaResourceType {
  return (MEDIA_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function isMediaScope(value: string): value is MediaScope {
  return (MEDIA_SCOPES as readonly string[]).includes(value);
}

export function isMediaSubmissionType(value: string): value is MediaSubmissionType {
  return (MEDIA_SUBMISSION_TYPES as readonly string[]).includes(value);
}

export function validateMediaLinks(
  links: Array<Partial<MediaLinkInput>> | undefined,
): { ok: true; value: MediaLinkInput[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!links?.length) {
    return { ok: false, errors: ['Add at least one media link.'] };
  }

  const normalized: MediaLinkInput[] = [];
  const seen = new Set<string>();

  links.forEach((link, index) => {
    const linkType = link.linkType;
    const url = link.url?.trim() ?? '';
    const label = link.label?.trim() || null;
    const row = `Link ${index + 1}`;

    if (!linkType || !isMediaResourceType(linkType)) {
      errors.push(`${row}: choose a link type.`);
      return;
    }
    if (!url) {
      errors.push(`${row}: enter a URL.`);
      return;
    }
    if (!isValidHttpUrl(url)) {
      errors.push(`${row}: URL must be a valid http(s) link.`);
      return;
    }

    const norm = normalizeMediaUrl(url);
    if (seen.has(norm)) {
      errors.push(`${row}: duplicate URL in this submission.`);
      return;
    }
    seen.add(norm);
    normalized.push({ linkType, url, label });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: normalized };
}

/** Client-side validation for creator-first multi-link submissions. */
export function validateMediaSubmissionInput(
  input: Partial<MediaSubmissionInput>,
): MediaValidationResult {
  const errors: string[] = [];
  const submissionType = input.submissionType;

  if (!submissionType || !isMediaSubmissionType(submissionType)) {
    errors.push('Choose whether this is a new creator or links for an existing creator.');
  }

  const linksResult = validateMediaLinks(input.links);
  if (!linksResult.ok) {
    errors.push(...linksResult.errors);
  }

  if (submissionType === 'new_creator') {
    const proposedName = input.proposedName?.trim() ?? '';
    if (proposedName.length < 2) {
      errors.push('Creator or outlet name is required.');
    }
    const scope = input.scope;
    if (!scope || !isMediaScope(scope)) {
      errors.push('Scope must be national or team-specific.');
    }
    const teamName = input.teamName?.trim() ?? '';
    if (scope === 'team' && teamName.length < 2) {
      errors.push('Team is required for team-specific submissions.');
    }
  }

  if (submissionType === 'add_links') {
    if (!input.existingCreatorId?.trim()) {
      errors.push('Select an existing creator or outlet.');
    }
  }

  if (!isValidOptionalEmail(input.submitterEmail)) {
    errors.push('Submitter email is not valid.');
  }

  if (errors.length > 0 || !linksResult.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      submissionType: submissionType as MediaSubmissionType,
      existingCreatorId:
        submissionType === 'add_links' ? input.existingCreatorId?.trim() || null : null,
      proposedName:
        submissionType === 'new_creator' ? input.proposedName?.trim() || null : null,
      proposedDescription: input.proposedDescription?.trim() || null,
      scope: submissionType === 'new_creator' ? (input.scope as MediaScope) : null,
      teamId:
        submissionType === 'new_creator' && input.scope === 'team'
          ? input.teamId?.trim() || null
          : null,
      teamName:
        submissionType === 'new_creator' && input.scope === 'team'
          ? input.teamName?.trim() || null
          : null,
      links: linksResult.value,
      submitterName: input.submitterName?.trim() || null,
      submitterEmail: input.submitterEmail?.trim() || null,
      submitterNotes: input.submitterNotes?.trim() || null,
    },
  };
}

/** Group public creators for National / Team directory sections. */
export function groupPublicMediaCreators(creators: PublicMediaCreator[]): {
  national: PublicMediaCreator[];
  team: PublicMediaCreator[];
} {
  const national: PublicMediaCreator[] = [];
  const team: PublicMediaCreator[] = [];
  for (const creator of creators) {
    if (creator.scope === 'team') team.push(creator);
    else national.push(creator);
  }
  return { national, team };
}
