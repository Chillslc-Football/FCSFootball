import { normalizeMediaSourceCoverage } from '@/data/mediaDirectory/mediaCoverage';
import {
  parseMediaLinkRowsFromApi,
  platformLinksToMediaLinkRows,
} from '@/data/mediaDirectory/mediaLinkRows';
import { MEDIA_SOURCE_SEEDS } from '@/data/mediaDirectory/mediaSourcesSeed';
import type { MediaSource, MediaSourceScope } from '@/data/mediaDirectory/types';
import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';

type MediaSourceRow = Partial<MediaSource> & {
  id: string;
  name: string;
  is_national?: boolean | null;
  team_ids?: string[] | null;
  conference_ids?: string[] | null;
  scope?: MediaSourceScope;
  links?: unknown;
};

function mapRow(row: MediaSourceRow): MediaSource {
  const coverage = normalizeMediaSourceCoverage(row);
  const fromApi = parseMediaLinkRowsFromApi(row.links);
  const links =
    fromApi.length > 0
      ? fromApi
      : platformLinksToMediaLinkRows({
          spotify: row.spotify_url ?? undefined,
          youtube: row.youtube_url ?? undefined,
          x: row.x_url ?? undefined,
          apple: row.apple_podcast_url ?? undefined,
        });
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? null,
    description: row.description ?? null,
    scope: coverage.scope,
    conference_id: coverage.conference_id,
    team_id: coverage.team_id,
    logo_url: row.logo_url ?? null,
    spotify_url: row.spotify_url ?? null,
    youtube_url: row.youtube_url ?? null,
    x_url: row.x_url ?? null,
    apple_podcast_url: row.apple_podcast_url ?? null,
    is_approved: Boolean(row.is_approved),
    display_order: Number(row.display_order ?? 100),
    isNational: coverage.isNational,
    teamIds: coverage.teamIds,
    conferenceIds: coverage.conferenceIds,
    links,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

type LoadApprovedMediaSourcesResult = {
  sources: MediaSource[];
  fromSeed: boolean;
  error?: string;
};

/** Session cache so team pages and Discover share one load. */
let approvedMediaSourcesCache: LoadApprovedMediaSourcesResult | null = null;

/** Resolve one approved source from the shared cache/load (no extra network path). */
export async function getApprovedMediaSourceById(
  id: string | null | undefined,
): Promise<MediaSource | null> {
  const needle = id?.trim();
  if (!needle) return null;
  const result = await loadApprovedMediaSources();
  return result.sources.find((source) => source.id === needle) ?? null;
}

/**
 * Load approved media sources from Supabase.
 * Falls back to local seed when unconfigured, empty, or on error.
 * Coverage arrays come from list_approved_media_sources (no N+1).
 */
export async function loadApprovedMediaSources(options?: {
  forceRefresh?: boolean;
}): Promise<LoadApprovedMediaSourcesResult> {
  if (!options?.forceRefresh && approvedMediaSourcesCache) {
    return approvedMediaSourcesCache;
  }

  if (!isSupabaseConfigured()) {
    approvedMediaSourcesCache = { sources: MEDIA_SOURCE_SEEDS, fromSeed: true };
    return approvedMediaSourcesCache;
  }

  const client = getSupabaseClient();
  if (!client) {
    approvedMediaSourcesCache = { sources: MEDIA_SOURCE_SEEDS, fromSeed: true };
    return approvedMediaSourcesCache;
  }

  try {
    const { data, error } = await client.rpc('list_approved_media_sources');
    if (error) {
      console.warn('[mediaSourcesApi] list_approved_media_sources failed:', error.message);
      approvedMediaSourcesCache = {
        sources: MEDIA_SOURCE_SEEDS,
        fromSeed: true,
        error: error.message,
      };
      return approvedMediaSourcesCache;
    }

    const rows = ((data ?? []) as MediaSourceRow[]).map(mapRow);
    if (rows.length === 0) {
      approvedMediaSourcesCache = { sources: MEDIA_SOURCE_SEEDS, fromSeed: true };
      return approvedMediaSourcesCache;
    }

    approvedMediaSourcesCache = { sources: rows, fromSeed: false };
    return approvedMediaSourcesCache;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load media';
    console.warn('[mediaSourcesApi] load failed:', message);
    approvedMediaSourcesCache = { sources: MEDIA_SOURCE_SEEDS, fromSeed: true, error: message };
    return approvedMediaSourcesCache;
  }
}
