import type { Game, Team } from '@/types';

/**
 * @deprecated Use EspnScoresProvider + NcaaRankingsProvider instead.
 * See src/data/ARCHITECTURE.md
 */
export type DataProvider = {
  getTop25(): Promise<Team[]>;
  getScores(): Promise<Game[]>;
  getSchedule(): Promise<Game[]>;
  getRankings(): Promise<Team[]>;
};

export type {
  EspnDataProvider,
  EspnFetchOptions,
  EspnScoresProvider,
  FCSDataProvider,
  NcaaRankingsProvider,
  ProviderFetchStatus,
  ProviderResponse,
  RankingMergeInput,
} from './types';
export { NCAA_FCS_TOP_25_URL } from './types';

export { MockDataProvider, mockDataProvider } from './mockProvider';
export {
  MockEspnScoresProvider,
  mockEspnScoresProvider,
  mockEspnProvider,
  MockEspnProvider,
} from './mockEspnProvider';
export {
  ESPN_FCS_SCOREBOARD_URL,
  EspnScoresProviderImpl,
  espnScoresProvider,
  espnProvider,
  EspnProvider,
} from './espnProvider';
export { ESPN_FETCH_TIMEOUT_MS, EspnFetchError, fetchEspnJson } from './espnFetch';
export {
  NcaaRankingsNotConnectedError,
  NcaaRankingsProviderImpl,
  ncaaRankingsProvider,
} from './ncaaRankingsProvider';
export { mergeRankingsOntoGames } from './rankingMerge';
export type { RankingMergeResult } from './rankingMerge';
export {
  extractEspnScoreboardDate,
  parseEspnScoreboard,
} from './espnParser';
