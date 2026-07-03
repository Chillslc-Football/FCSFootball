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
  compareEspnWeekQueryFormats,
  ESPN_SCOREBOARD_BASE,
  ESPN_WEEK_FORMAT_VARIANTS,
  ESPN_WEEK_QUERY_PRESETS,
  buildEspnWeekScoreboardUrl,
} from './espnWeekQuery';
export type {
  EspnFormatCompareResult,
  EspnWeekPresetId,
  EspnWeekQueryPreset,
} from './espnWeekQuery';
export {
  ESPN_FCS_SCOREBOARD_URL,
  buildEspnFcsScoreboardUrl,
  formatEspnDateParam,
  getLocalTodayIsoDate,
  EspnScoresProviderImpl,
  espnScoresProvider,
  espnProvider,
  EspnProvider,
} from './espnProvider';
export { ESPN_FETCH_TIMEOUT_MS, EspnFetchError, fetchEspnJson } from './espnFetch';
export {
  formatEspnResponseSize,
  testEspnConnectivity,
} from './espnConnectivity';
export type { EspnConnectivityResult } from './espnConnectivity';
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
  parseEspnScoreboardNormalized,
  parseFirstEspnGame,
  summarizeParsedEspnGames,
  diagnoseEspnScoreboard,
} from './espnParser';
export type {
  EspnParsedGamesSummary,
  EspnScoreboardDiagnostics,
  EspnScoreboardParseResult,
  ParseFirstEspnGameResult,
} from './espnParser';
export {
  filterUpsetWatchGames,
  formatKickoffTime,
  pickFeaturedGame,
  toGameStatus,
  toScoreboardGame,
  toUpsetWatchGame,
} from './espnTodayMapper';
export {
  getScheduleWeekConfig,
  SCHEDULE_WEEK_CONFIG,
  SCHEDULE_WEEK_OPTIONS,
} from './espnScheduleWeek';
export type { ScheduleWeekConfig, ScheduleWeekFetchStrategy } from './espnScheduleWeek';
export {
  formatScheduleDateLabel,
  groupScheduleGamesByDate,
  toScheduleGame,
} from './espnScheduleMapper';
export type { ScheduleDateGroup } from './espnScheduleMapper';
