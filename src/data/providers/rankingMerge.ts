import {
  fetchEspnApTop25Lookup,
  isEspnFbsTop25Rank,
  resolveEspnFbsTeamRank,
  type EspnFbsRankLookup,
} from '@/data/providers/espnFbsRankings';
import {
  buildRankLookup,
  lookupTeamRank,
  registerAliasKeys,
} from '@/data/providers/teamNameMatch';
import { loadNcaaRankingsForEnrichment } from '@/data/providers/ncaaRankingsEnrichment';
import type { RankingMergeInput, ScoresLeagueFilterId } from '@/data/providers/types';
import type { EspnNormalizedGame, NcaaRankingsPayload, RankedTeam } from '@/types';

export type RankingMergeResult = {
  games: EspnNormalizedGame[];
  rankedTeamsLoaded: number;
  gamesWithRankMatches: number;
  matchedRankCount: number;
  unmatchedRankedTeams: RankedTeam[];
};

function applyRankFields(
  game: EspnNormalizedGame,
  awayRank: number | undefined,
  homeRank: number | undefined,
): EspnNormalizedGame {
  return {
    ...game,
    awayRank,
    homeRank,
    awayIsRanked: awayRank != null,
    homeIsRanked: homeRank != null,
  };
}

function resolveGameSideFbsRank(
  game: EspnNormalizedGame,
  side: 'away' | 'home',
  lookup: EspnFbsRankLookup,
): number | undefined {
  const parsedCurated =
    side === 'away' ? game.awayEspnCuratedRank : game.homeEspnCuratedRank;
  const teamId = side === 'away' ? game.awayTeamId : game.homeTeamId;
  return resolveEspnFbsTeamRank(teamId, parsedCurated, lookup);
}

function applyEspnFbsRankingsToGames(
  games: EspnNormalizedGame[],
  lookup: EspnFbsRankLookup,
): { games: EspnNormalizedGame[]; gamesWithRankMatches: number; matchedRankCount: number } {
  let gamesWithRankMatches = 0;
  let matchedRankCount = 0;

  const mergedGames = games.map((game) => {
    const awayRank = resolveGameSideFbsRank(game, 'away', lookup);
    const homeRank = resolveGameSideFbsRank(game, 'home', lookup);

    if (awayRank != null) matchedRankCount++;
    if (homeRank != null) matchedRankCount++;
    if (awayRank != null || homeRank != null) {
      gamesWithRankMatches++;
    }

    return {
      ...applyRankFields(game, awayRank, homeRank),
      awayEspnCuratedRank: awayRank ?? game.awayEspnCuratedRank,
      homeEspnCuratedRank: homeRank ?? game.homeEspnCuratedRank,
    };
  });

  return { games: mergedGames, gamesWithRankMatches, matchedRankCount };
}

/**
 * Attach NCAA Top 25 ranks from static poll data onto ESPN normalized games.
 * Rankings never originate from ESPN — only from RankedTeam[] input.
 */
export function mergeRankingsOntoGames(input: RankingMergeInput): RankingMergeResult {
  const { rankings, games } = input;
  const lookup = buildRankLookup(rankings);
  registerAliasKeys(lookup);

  const matchedPollNames = new Set<string>();
  let gamesWithRankMatches = 0;
  let matchedRankCount = 0;

  const mergedGames = games.map((game) => {
    const awayRank = lookupTeamRank(game.awayTeam, lookup);
    const homeRank = lookupTeamRank(game.homeTeam, lookup);

    if (awayRank != null) {
      matchedRankCount++;
      matchedPollNames.add(findPollNameForRank(rankings, awayRank, game.awayTeam) ?? game.awayTeam);
    }
    if (homeRank != null) {
      matchedRankCount++;
      matchedPollNames.add(findPollNameForRank(rankings, homeRank, game.homeTeam) ?? game.homeTeam);
    }
    if (awayRank != null || homeRank != null) {
      gamesWithRankMatches++;
    }

    return applyRankFields(game, awayRank, homeRank);
  });

  const unmatchedRankedTeams = rankings.filter(
    (entry) => !matchedPollNames.has(entry.team.name),
  );

  const result: RankingMergeResult = {
    games: mergedGames,
    rankedTeamsLoaded: rankings.length,
    gamesWithRankMatches,
    matchedRankCount,
    unmatchedRankedTeams,
  };

  if (__DEV__) {
    console.log('[Ranking Merge]', {
      rankedTeamsLoaded: result.rankedTeamsLoaded,
      gamesTotal: games.length,
      gamesWithRankMatches: result.gamesWithRankMatches,
      matchedRankCount: result.matchedRankCount,
      unmatchedRankedTeams: result.unmatchedRankedTeams.map((t) => t.team.name),
    });
  }

  return result;
}

function findPollNameForRank(
  rankings: RankedTeam[],
  rank: number,
  espnName: string,
): string | undefined {
  const matches = rankings.filter((entry) => entry.rank === rank);
  if (matches.length === 1) return matches[0].team.name;
  const lowerEspn = espnName.toLowerCase();
  return matches.find((entry) => lowerEspn.includes(entry.team.name.toLowerCase()))?.team.name;
}

function emptyRankingMergeResult(games: EspnNormalizedGame[]): RankingMergeResult {
  return {
    games,
    rankedTeamsLoaded: 0,
    gamesWithRankMatches: 0,
    matchedRankCount: 0,
    unmatchedRankedTeams: [],
  };
}

/**
 * Load NCAA Top 25 (cache-first, non-fatal) and merge onto ESPN games.
 * Ranking fetch failure returns games unchanged — never throws for poll errors.
 */
export async function mergeStaticRankingsOntoGames(
  games: EspnNormalizedGame[],
  options?: {
    loadRankings?: () => Promise<NcaaRankingsPayload | null>;
  },
): Promise<RankingMergeResult> {
  let payload: NcaaRankingsPayload | null = null;
  try {
    payload = await (options?.loadRankings ?? loadNcaaRankingsForEnrichment)();
  } catch (error) {
    console.warn('[mergeStaticRankingsOntoGames] rankings unavailable (non-fatal):', error);
    return emptyRankingMergeResult(games);
  }

  if (!payload?.teams?.length) {
    return emptyRankingMergeResult(games);
  }

  return mergeRankingsOntoGames({
    rankings: payload.teams,
    games,
  });
}

/** Apply ESPN AP/curated ranks (1–25) onto FBS games. */
export async function applyEspnFbsRankings(
  games: EspnNormalizedGame[],
): Promise<RankingMergeResult> {
  const lookup = await fetchEspnApTop25Lookup();
  const { games: mergedGames, gamesWithRankMatches, matchedRankCount } =
    applyEspnFbsRankingsToGames(games, lookup);

  return {
    games: mergedGames,
    rankedTeamsLoaded: lookup.byTeamId.size,
    gamesWithRankMatches,
    matchedRankCount,
    unmatchedRankedTeams: [],
  };
}

function overlayEspnFbsRankingsOnFbsTeams(
  games: EspnNormalizedGame[],
  lookup: EspnFbsRankLookup,
): EspnNormalizedGame[] {
  return games.map((game) => {
    const awayRank =
      game.awayDivision === 'fbs'
        ? resolveGameSideFbsRank(game, 'away', lookup) ?? game.awayRank
        : game.awayRank;
    const homeRank =
      game.homeDivision === 'fbs'
        ? resolveGameSideFbsRank(game, 'home', lookup) ?? game.homeRank
        : game.homeRank;

    return {
      ...applyRankFields(game, awayRank, homeRank),
      awayEspnCuratedRank: awayRank ?? game.awayEspnCuratedRank,
      homeEspnCuratedRank: homeRank ?? game.homeEspnCuratedRank,
    };
  });
}

/** Scores tab rankings — NCAA for FCS, ESPN AP/curated for FBS. */
export async function mergeScoresTabRankings(
  games: EspnNormalizedGame[],
  league: ScoresLeagueFilterId,
): Promise<RankingMergeResult> {
  if (league === 'fbs') {
    return applyEspnFbsRankings(games);
  }

  const ncaaResult = await mergeStaticRankingsOntoGames(games);

  if (league === 'fcs') {
    return ncaaResult;
  }

  const lookup = await fetchEspnApTop25Lookup();

  return {
    ...ncaaResult,
    games: overlayEspnFbsRankingsOnFbsTeams(ncaaResult.games, lookup),
  };
}

/** @deprecated Use applyEspnFbsRankings */
export function applyEspnCuratedRanks(games: EspnNormalizedGame[]): RankingMergeResult {
  const lookup: EspnFbsRankLookup = { pollName: 'AP Top 25', byTeamId: new Map() };
  const { games: mergedGames, gamesWithRankMatches, matchedRankCount } =
    applyEspnFbsRankingsToGames(games, lookup);

  return {
    games: mergedGames,
    rankedTeamsLoaded: 0,
    gamesWithRankMatches,
    matchedRankCount,
    unmatchedRankedTeams: [],
  };
}
