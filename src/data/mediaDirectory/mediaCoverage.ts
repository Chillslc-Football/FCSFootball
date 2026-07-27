import type { MediaSource, MediaSourceScope } from '@/data/mediaDirectory/types';

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

/** Resolve national flag with legacy scope fallback. */
export function isMediaSourceNational(source: Pick<MediaSource, 'isNational' | 'scope'>): boolean {
  if (typeof source.isNational === 'boolean') return source.isNational;
  return source.scope === 'national';
}

/** Resolve team ids with legacy team_id fallback. */
export function getMediaSourceTeamIds(
  source: Pick<MediaSource, 'teamIds' | 'team_id' | 'scope'>,
): string[] {
  if (Array.isArray(source.teamIds) && source.teamIds.length > 0) {
    return uniqueIds(source.teamIds);
  }
  if (source.team_id?.trim()) {
    return [source.team_id.trim()];
  }
  return [];
}

/** Resolve conference ids with legacy conference_id fallback. */
export function getMediaSourceConferenceIds(
  source: Pick<MediaSource, 'conferenceIds' | 'conference_id'>,
): string[] {
  if (Array.isArray(source.conferenceIds) && source.conferenceIds.length > 0) {
    return uniqueIds(source.conferenceIds);
  }
  if (source.conference_id?.trim()) {
    return [source.conference_id.trim()];
  }
  return [];
}

export function sourceMatchesTeam(
  source: Pick<MediaSource, 'teamIds' | 'team_id' | 'scope'>,
  teamId: string,
): boolean {
  const needle = teamId.trim();
  if (!needle) return false;
  return getMediaSourceTeamIds(source).includes(needle);
}

export function sourceMatchesAnyTeam(
  source: Pick<MediaSource, 'teamIds' | 'team_id' | 'scope'>,
  teamIds: string[],
): boolean {
  const set = new Set(teamIds.map((id) => id.trim()).filter(Boolean));
  if (set.size === 0) return false;
  return getMediaSourceTeamIds(source).some((id) => set.has(id));
}

export function sourceMatchesConference(
  source: Pick<MediaSource, 'conferenceIds' | 'conference_id'>,
  conferenceId: string,
): boolean {
  const needle = conferenceId.trim();
  if (!needle) return false;
  return getMediaSourceConferenceIds(source).includes(needle);
}

/** Normalize a raw API/seed row into a MediaSource with coverage fields filled. */
export function normalizeMediaSourceCoverage(
  row: Partial<MediaSource> & {
    is_national?: boolean | null;
    team_ids?: string[] | null;
    conference_ids?: string[] | null;
  },
): Pick<MediaSource, 'isNational' | 'teamIds' | 'conferenceIds' | 'scope' | 'team_id' | 'conference_id'> {
  const legacyScope = (row.scope ?? 'national') as MediaSourceScope;
  const teamIds = uniqueIds([
    ...(Array.isArray(row.teamIds) ? row.teamIds : []),
    ...(Array.isArray(row.team_ids) ? row.team_ids : []),
    row.team_id,
  ]);
  const conferenceIds = uniqueIds([
    ...(Array.isArray(row.conferenceIds) ? row.conferenceIds : []),
    ...(Array.isArray(row.conference_ids) ? row.conference_ids : []),
    row.conference_id,
  ]);

  let isNational =
    typeof row.isNational === 'boolean'
      ? row.isNational
      : typeof row.is_national === 'boolean'
        ? row.is_national
        : legacyScope === 'national';

  // Legacy national rows with no joins
  if (!isNational && teamIds.length === 0 && conferenceIds.length === 0 && legacyScope === 'national') {
    isNational = true;
  }

  return {
    isNational,
    teamIds,
    conferenceIds,
    scope: legacyScope,
    team_id: row.team_id?.trim() || teamIds[0] || null,
    conference_id: row.conference_id?.trim() || conferenceIds[0] || null,
  };
}
