/**
 * Dependency-free duplicate candidate ranking for Media Admin suggestion detail.
 */

export type MediaAdminDuplicateCandidate = {
  id: string;
  name: string;
  logoUrl?: string | null;
  isNational?: boolean;
  teamIds?: string[];
  conferenceIds?: string[];
  urls?: string[];
  reasons: Array<'exact_name' | 'similar_name' | 'url_overlap'>;
  score: number;
  matchLabel: 'Exact' | 'Strong' | 'Possible';
};

export function normalizeMediaAdminName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function normalizeMediaAdminUrlKey(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '');
}

/** Dice coefficient on character bigrams — small, dependency-free similarity. */
export function mediaAdminNameSimilarity(a: string, b: string): number {
  const left = normalizeMediaAdminName(a);
  const right = normalizeMediaAdminName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  function bigrams(value: string): string[] {
    if (value.length < 2) return [value];
    const out: string[] = [];
    for (let i = 0; i < value.length - 1; i += 1) out.push(value.slice(i, i + 2));
    return out;
  }

  const aGrams = bigrams(left);
  const bGrams = bigrams(right);
  const counts = new Map<string, number>();
  for (const gram of aGrams) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  let overlap = 0;
  for (const gram of bGrams) {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (aGrams.length + bGrams.length);
}

export function scoreMediaAdminDuplicate(input: {
  suggestionName: string;
  suggestionUrls: string[];
  candidateName: string;
  candidateUrls: string[];
}): Omit<MediaAdminDuplicateCandidate, 'id' | 'name' | 'logoUrl' | 'isNational' | 'teamIds' | 'conferenceIds'> {
  const suggestionName = normalizeMediaAdminName(input.suggestionName);
  const candidateName = normalizeMediaAdminName(input.candidateName);
  const suggestionUrls = new Set(input.suggestionUrls.map(normalizeMediaAdminUrlKey).filter(Boolean));
  const candidateUrls = input.candidateUrls.map(normalizeMediaAdminUrlKey).filter(Boolean);

  const reasons: MediaAdminDuplicateCandidate['reasons'] = [];
  let score = 0;

  if (suggestionName && candidateName && suggestionName === candidateName) {
    reasons.push('exact_name');
    score += 100;
  } else {
    const similarity = mediaAdminNameSimilarity(suggestionName, candidateName);
    if (similarity >= 0.72) {
      reasons.push('similar_name');
      score += Math.round(similarity * 55);
    } else if (
      suggestionName &&
      candidateName &&
      (candidateName.includes(suggestionName) || suggestionName.includes(candidateName))
    ) {
      reasons.push('similar_name');
      score += 35;
    }
  }

  const overlapping = candidateUrls.filter((url) => suggestionUrls.has(url));
  if (overlapping.length > 0) {
    reasons.push('url_overlap');
    score += overlapping.length * 80;
  }

  const matchLabel: MediaAdminDuplicateCandidate['matchLabel'] =
    score >= 100 ? 'Exact' : score >= 70 ? 'Strong' : 'Possible';

  return { reasons, score, matchLabel };
}

export function rankMediaAdminDuplicates(input: {
  suggestionName: string;
  suggestionUrls: string[];
  candidates: Array<{
    id: string;
    name: string;
    logoUrl?: string | null;
    isNational?: boolean;
    teamIds?: string[];
    conferenceIds?: string[];
    urls?: string[];
  }>;
  limit?: number;
}): MediaAdminDuplicateCandidate[] {
  const limit = input.limit ?? 5;
  return input.candidates
    .map((candidate) => {
      const scored = scoreMediaAdminDuplicate({
        suggestionName: input.suggestionName,
        suggestionUrls: input.suggestionUrls,
        candidateName: candidate.name,
        candidateUrls: candidate.urls ?? [],
      });
      return {
        id: candidate.id,
        name: candidate.name,
        logoUrl: candidate.logoUrl ?? null,
        isNational: candidate.isNational,
        teamIds: candidate.teamIds ?? [],
        conferenceIds: candidate.conferenceIds ?? [],
        urls: candidate.urls ?? [],
        ...scored,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type MediaAdminMergeFieldSelection = {
  copyLinks: boolean;
  copyArtwork: boolean;
  copyDescription: boolean;
  copyTeams: boolean;
  copyConferences: boolean;
  copyNational: boolean;
};

export function summarizeMediaAdminMerge(input: {
  selection: MediaAdminMergeFieldSelection;
  existing: {
    name: string;
    description: string | null;
    logoUrl: string | null;
    isNational: boolean;
    teamIds: string[];
    conferenceIds: string[];
    urls: string[];
  };
  suggestion: {
    description: string | null;
    logoUrl: string | null;
    isNational: boolean;
    teamIds: string[];
    conferenceIds: string[];
    urls: string[];
  };
}): {
  lines: string[];
  newLinkCount: number;
  willReplaceArtwork: boolean;
  willReplaceDescription: boolean;
} {
  const existingUrlKeys = new Set(input.existing.urls.map(normalizeMediaAdminUrlKey));
  const newLinkCount = input.suggestion.urls.filter(
    (url) => !existingUrlKeys.has(normalizeMediaAdminUrlKey(url)),
  ).length;

  const lines: string[] = [];
  if (input.selection.copyLinks) {
    lines.push(
      newLinkCount > 0
        ? `Add ${newLinkCount} new link${newLinkCount === 1 ? '' : 's'} (duplicates skipped)`
        : 'No new links to add (all URLs already exist)',
    );
  }
  const willReplaceArtwork = Boolean(
    input.selection.copyArtwork && input.suggestion.logoUrl?.trim(),
  );
  if (willReplaceArtwork) {
    lines.push(
      input.existing.logoUrl?.trim()
        ? 'Replace existing artwork'
        : 'Set artwork from suggestion',
    );
  }
  const willReplaceDescription = Boolean(
    input.selection.copyDescription && input.suggestion.description?.trim(),
  );
  if (willReplaceDescription) {
    lines.push(
      input.existing.description?.trim()
        ? 'Replace existing description'
        : 'Set description from suggestion',
    );
  }
  if (input.selection.copyTeams) lines.push('Merge team coverage');
  if (input.selection.copyConferences) lines.push('Merge conference coverage');
  if (input.selection.copyNational && input.suggestion.isNational) {
    lines.push('Enable National coverage');
  }

  return { lines, newLinkCount, willReplaceArtwork, willReplaceDescription };
}
