import { mapStaticFcsTop25ToPayload, getStaticFcsTop25File } from '@/data/static/staticRankings';
import { NCAA_RANKINGS_INVESTIGATION } from '@/data/providers/ncaaRankingsInvestigation';
import type { NcaaRankingsProvider, ProviderResponse } from '@/data/providers/types';
import { NCAA_FCS_TOP_25_URL } from '@/data/providers/types';
import type { NcaaRankingsPayload } from '@/types';

export class NcaaRankingsNotConnectedError extends Error {
  readonly reason = 'no_reliable_json_source' as const;

  constructor() {
    super(
      'NCAA Stats Perform FCS Top 25 is not connected yet. ' +
        'No official JSON API was found — rankings require a server-side cache. ' +
        'See src/data/providers/NCAA_RANKINGS_INVESTIGATION.md',
    );
    this.name = 'NcaaRankingsNotConnectedError';
  }
}

/**
 * NCAA Stats Perform FCS Top 25 provider.
 *
 * Phase 10 adjustment: reads bundled static JSON (manual weekly updates).
 * Does not scrape NCAA.com from the mobile app.
 */
export class NcaaRankingsProviderImpl implements NcaaRankingsProvider {
  readonly id = 'ncaa-rankings' as const;
  readonly displayName = 'NCAA Stats Perform FCS Top 25';
  readonly sourceUrl = NCAA_FCS_TOP_25_URL;
  readonly investigation = NCAA_RANKINGS_INVESTIGATION;

  async getTop25(): Promise<ProviderResponse<NcaaRankingsPayload>> {
    const start = Date.now();
    const file = getStaticFcsTop25File();
    const payload = mapStaticFcsTop25ToPayload(file);

    return {
      providerId: this.id,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      data: payload,
    };
  }
}

export const ncaaRankingsProvider = new NcaaRankingsProviderImpl();

/** Documented future JSON endpoint env key — set when rankings cache is deployed. */
export const NCAA_RANKINGS_PROXY_URL_ENV = 'EXPO_PUBLIC_NCAA_RANKINGS_PROXY_URL';
