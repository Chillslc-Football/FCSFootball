import type { NcaaRankingsProvider, ProviderResponse } from '@/data/providers/types';
import { NCAA_FCS_TOP_25_URL } from '@/data/providers/types';
import type { RankedTeam } from '@/types';

export class NcaaRankingsNotConnectedError extends Error {
  constructor() {
    super(
      'NCAA Stats Perform FCS Top 25 is not connected yet. ' +
        'ESPN rankings are not used for FCS Top 25 — see ncaaRankingsProvider.',
    );
    this.name = 'NcaaRankingsNotConnectedError';
  }
}

/**
 * Placeholder for NCAA Stats Perform FCS Top 25.
 * Production Top 25 / Rankings screens use mock data until this is implemented.
 */
export class NcaaRankingsProviderImpl implements NcaaRankingsProvider {
  readonly id = 'ncaa-rankings' as const;
  readonly displayName = 'NCAA Stats Perform FCS Top 25';
  readonly sourceUrl = NCAA_FCS_TOP_25_URL;

  async getTop25(): Promise<ProviderResponse<RankedTeam[]>> {
    throw new NcaaRankingsNotConnectedError();
  }
}

export const ncaaRankingsProvider = new NcaaRankingsProviderImpl();
