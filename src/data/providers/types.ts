import type { EspnTodayGamesPayload, RankedTeam, ScoreboardGame } from '@/types';

export type ProviderFetchStatus = 'idle' | 'loading' | 'success' | 'error';

export type ProviderResponse<T = unknown> = {
  data: T;
  durationMs: number;
  providerId: string;
  timestamp: string;
};

export type EspnFetchOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

/** Official FCS Top 25 page — rankings source of truth (not ESPN). */
export const NCAA_FCS_TOP_25_URL =
  'https://www.ncaa.com/rankings/football/fcs/stats-perform-fcs-top-25';

/**
 * ESPN is for game/event data only — never FCS Top 25 rankings.
 *
 * Responsibilities:
 * - Scores (live/final)
 * - Schedule / kickoff times
 * - Game status
 * - Broadcast / TV info
 * - ESPN game IDs and watch links
 */
export interface EspnScoresProvider {
  readonly id: 'espn-scores';
  readonly displayName: string;

  getTodayGames(options?: EspnFetchOptions): Promise<ProviderResponse<EspnTodayGamesPayload>>;
}

/** @deprecated Use EspnScoresProvider */
export type EspnDataProvider = EspnScoresProvider;

/**
 * NCAA Stats Perform FCS Top 25 — authoritative rankings provider.
 *
 * Do not substitute ESPN poll or ranking endpoints for this data.
 */
export interface NcaaRankingsProvider {
  readonly id: 'ncaa-rankings';
  readonly displayName: string;

  getTop25(options?: EspnFetchOptions): Promise<ProviderResponse<RankedTeam[]>>;
}

/**
 * Input for future mergeRankingsOntoGames() — attach NCAA ranks to ESPN games.
 * Rankings always originate from ncaaRankingsProvider; ESPN supplies game shells.
 */
export type RankingMergeInput = {
  rankings: RankedTeam[];
  games: ScoreboardGame[];
};

/**
 * @deprecated Split responsibilities use EspnScoresProvider + NcaaRankingsProvider.
 * Legacy combined interface from early scaffolding.
 */
export interface FCSDataProvider {
  readonly id: string;
  readonly displayName: string;

  fetchSnapshot(): Promise<ProviderResponse>;
  getTop25(): Promise<import('@/types').Team[]>;
  getScores(): Promise<ScoreboardGame[]>;
  getSchedule(): Promise<unknown[]>;
  getRankings(): Promise<import('@/types').Team[]>;
}
