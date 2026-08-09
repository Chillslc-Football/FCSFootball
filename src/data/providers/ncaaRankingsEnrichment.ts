/**
 * Safe NCAA Top 25 enrichment for Team / schedule ranking overlays.
 * Live poll failures must never become fatal page errors.
 */

import { loadCachedPollPayload } from '@/data/polls/pollWeekRefresh';
import { ncaaRankingsProvider } from '@/data/providers/ncaaRankingsProvider';
import type { NcaaRankingsPayload } from '@/types';

/** Short timeout so Team page is not held behind a long rankings hang. */
export const NCAA_ENRICHMENT_TIMEOUT_MS = 5_000;

/**
 * Resolve rankings for optional enrichment.
 *
 * Order:
 * 1. Cached poll payload (fast, offline-capable)
 * 2. Live NCAA fetch (short timeout)
 * 3. null → callers omit rank
 */
export async function loadNcaaRankingsForEnrichment(options?: {
  /** When true (default), return cache immediately without waiting on live network. */
  preferCache?: boolean;
  timeoutMs?: number;
}): Promise<NcaaRankingsPayload | null> {
  const preferCache = options?.preferCache ?? true;
  const timeoutMs = options?.timeoutMs ?? NCAA_ENRICHMENT_TIMEOUT_MS;

  if (preferCache) {
    try {
      const cached = await loadCachedPollPayload();
      if (cached?.teams?.length) {
        return cached;
      }
    } catch (error) {
      console.warn('[ncaaRankingsEnrichment] cache read failed:', error);
    }
  }

  try {
    const response = await ncaaRankingsProvider.getTop25({ timeoutMs });
    if (response.data?.teams?.length) {
      return response.data;
    }
  } catch (error) {
    console.warn('[ncaaRankingsEnrichment] live fetch failed (non-fatal):', error);
  }

  if (!preferCache) {
    try {
      const cached = await loadCachedPollPayload();
      if (cached?.teams?.length) {
        return cached;
      }
    } catch {
      // ignore
    }
  }

  return null;
}
