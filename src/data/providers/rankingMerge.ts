import type { RankingMergeInput } from '@/data/providers/types';
import type { RankedTeam, ScoreboardGame } from '@/types';

/**
 * Future: match NCAA Top 25 teams onto ESPN game objects for ranked badges.
 *
 * Matching strategy (TBD):
 * - Normalize school names (lowercase, strip punctuation)
 * - Alias map for known mismatches (e.g. "North Dakota State" vs "NDSU")
 * - Never infer rank from ESPN — only from ncaaRankingsProvider data
 */
export function mergeRankingsOntoGames(
  _input: RankingMergeInput,
): ScoreboardGame[] {
  throw new Error(
    'mergeRankingsOntoGames is not implemented yet. ' +
      'Rankings must come from ncaaRankingsProvider; games from espnScoresProvider.',
  );
}

/** Placeholder export for tests — returns empty until merge is built */
export type RankingMergeResult = {
  games: ScoreboardGame[];
  matchedRankCount: number;
  unmatchedRankedTeams: RankedTeam[];
};
