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
  buildEspnEndpointCacheKey,
  buildEspnTodayCacheKey,
  buildEspnWeekCacheKey,
  clearEspnCache,
  ESPN_CACHE_TTL_DEFAULT_MS,
  ESPN_CACHE_TTL_LIVE_MS,
  getOrFetchEspnCached,
  hasValidEspnCacheEntry,
  resolveEspnCacheTtlMs,
} from './espnCache';
export type { EspnScoreboardCachePayload } from './espnCache';
export { forceRefreshEspnData } from './espnRefresh';
export {
  formatEspnResponseSize,
  testEspnConnectivity,
} from './espnConnectivity';
export type { EspnConnectivityResult } from './espnConnectivity';
export {
  getStaticFcsTop25File,
  mapStaticFcsTop25ToPayload,
} from '../static/staticRankings';
export type { StaticFcsTop25Entry, StaticFcsTop25File } from '../static/staticRankings';
export {
  NcaaRankingsNotConnectedError,
  NcaaRankingsProviderImpl,
  ncaaRankingsProvider,
  NCAA_RANKINGS_PROXY_URL_ENV,
} from './ncaaRankingsProvider';
export { NCAA_RANKINGS_INVESTIGATION } from './ncaaRankingsInvestigation';
export type {
  NcaaRankingsProductionStatus,
  NcaaRankingsRetrievalMethod,
} from './ncaaRankingsInvestigation';
export {
  mapNcaaRankingsProxyResponse,
} from './ncaaRankingsParser';
export type {
  NcaaRankingsParseResult,
  NcaaRankingsProxyResponse,
  NcaaRankingsProxyRow,
} from './ncaaRankingsParser';
export {
  NCAA_RANKINGS_FETCH_TIMEOUT_MS,
  testNcaaRankingsPageReachability,
} from './ncaaConnectivity';
export type { NcaaRankingsReachabilityResult } from './ncaaConnectivity';
export { mergeRankingsOntoGames, mergeStaticRankingsOntoGames } from './rankingMerge';
export type { RankingMergeResult } from './rankingMerge';
export {
  buildRankLookup,
  lookupTeamRank,
  normalizeTeamName,
  registerAliasKeys,
} from './teamNameMatch';
export { FCS_TEAM_ALIASES } from '../static/teamAliases';
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
export type { ScheduleWeekConfig, ScheduleWeekFetchStrategy, ScheduleWeekMeta } from './espnScheduleWeek';
export {
  formatCollegeWeekDateRange,
  formatWeekDisplayLabel,
  getScheduleWeekLabel,
  getScheduleWeekMeta,
  SCORES_WEEK_OPTIONS,
  getScheduleWeekConfig,
  SCHEDULE_WEEK_CONFIG,
  SCHEDULE_WEEK_OPTIONS,
} from './espnScheduleWeek';
export {
  formatScheduleDateLabel,
  groupScheduleGamesByDate,
  toScheduleGame,
} from './espnScheduleMapper';
export type { ScheduleDateGroup } from './espnScheduleMapper';
export {
  buildEspnWebGameUrl,
  buildSportscenterGameDeepLink,
  openWatchOnEspn,
  resolveEspnWatchTargets,
} from './espnWatchLinks';
export type { EspnWatchResolution } from './espnWatchLinks';
