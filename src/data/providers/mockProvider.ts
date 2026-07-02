import {
  MOCK_FINAL_GAMES,
  MOCK_LIVE_GAMES,
  MOCK_TOP_25,
  MOCK_TOP_25_META,
  MOCK_UPCOMING_GAMES,
} from '@/data/mock';
import type { FCSDataProvider, ProviderResponse } from '@/data/providers/types';
import type { ScoreboardGame, Team } from '@/types';

const MOCK_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockDataProvider implements FCSDataProvider {
  readonly id = 'mock';
  readonly displayName = 'Mock Provider';

  async fetchSnapshot(): Promise<ProviderResponse> {
    const start = Date.now();
    await delay(MOCK_DELAY_MS);

    return {
      providerId: this.id,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      data: {
        source: this.displayName,
        note: 'Simulated provider response — not live ESPN/NCAA data',
        poll: MOCK_TOP_25_META,
        top25Count: MOCK_TOP_25.length,
        top25Sample: MOCK_TOP_25.slice(0, 5),
        scores: {
          live: MOCK_LIVE_GAMES,
          upcoming: MOCK_UPCOMING_GAMES,
          final: MOCK_FINAL_GAMES,
        },
      },
    };
  }

  async getTop25(): Promise<Team[]> {
    await delay(MOCK_DELAY_MS);
    return MOCK_TOP_25.map(({ team }) => team);
  }

  async getScores(): Promise<ScoreboardGame[]> {
    await delay(MOCK_DELAY_MS);
    return [...MOCK_LIVE_GAMES, ...MOCK_UPCOMING_GAMES, ...MOCK_FINAL_GAMES];
  }

  async getSchedule(): Promise<unknown[]> {
    await delay(MOCK_DELAY_MS);
    return MOCK_UPCOMING_GAMES;
  }

  async getRankings(): Promise<Team[]> {
    await delay(MOCK_DELAY_MS);
    return MOCK_TOP_25.map(({ team }) => team);
  }
}

export const mockDataProvider = new MockDataProvider();
