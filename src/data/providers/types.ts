import type { ScoreboardGame, Team } from '@/types';

export type ProviderFetchStatus = 'idle' | 'loading' | 'success' | 'error';

export type ProviderResponse<T = unknown> = {
  data: T;
  durationMs: number;
  providerId: string;
  timestamp: string;
};

/**
 * Contract for future ESPN, NCAA, and other FCS data providers.
 */
export interface FCSDataProvider {
  readonly id: string;
  readonly displayName: string;

  /** Dev/test hook — returns a snapshot payload for inspection */
  fetchSnapshot(): Promise<ProviderResponse>;

  getTop25(): Promise<Team[]>;
  getScores(): Promise<ScoreboardGame[]>;
  getSchedule(): Promise<unknown[]>;
  getRankings(): Promise<Team[]>;
}

