import type { Game, Team } from '@/types';

/**
 * @deprecated Use FCSDataProvider from './types' instead.
 */
export type DataProvider = {
  getTop25(): Promise<Team[]>;
  getScores(): Promise<Game[]>;
  getSchedule(): Promise<Game[]>;
  getRankings(): Promise<Team[]>;
};

export type { FCSDataProvider, ProviderFetchStatus, ProviderResponse } from './types';
export { MockDataProvider, mockDataProvider } from './mockProvider';
