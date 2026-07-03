import {
  buildRankLookup,
  lookupTeamRank,
  registerAliasKeys,
} from '@/data/providers/teamNameMatch';
import { ncaaRankingsProvider } from '@/data/providers/ncaaRankingsProvider';
import type { RankingMergeInput } from '@/data/providers/types';
import type { EspnNormalizedGame, RankedTeam } from '@/types';

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

/** Load rankings from static provider and merge onto ESPN games. */
export async function mergeStaticRankingsOntoGames(
  games: EspnNormalizedGame[],
): Promise<RankingMergeResult> {
  const response = await ncaaRankingsProvider.getTop25();
  return mergeRankingsOntoGames({
    rankings: response.data.teams,
    games,
  });
}
