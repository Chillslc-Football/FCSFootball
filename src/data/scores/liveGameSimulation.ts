/**
 * Pure helpers for developer live-game simulation tests.
 * Does not touch production ESPN fetch paths.
 */

import { parseEspnScoreboardNormalized } from '@/data/providers/espnParser';
import {
  formatEspnGameStatusLabel,
  shouldPollEspnNormalizedStatus,
} from '@/data/providers/espnGameStatus';
import {
  createScoresRequestGeneration,
  resolveScoresVisibleUpdate,
  type ScoresFetchContext,
} from '@/data/scores/scoresRequestGuard';
import { hasLiveEspnNormalizedGames } from '@/data/scores/scoresLiveRefresh';
import type { EspnNormalizedGame } from '@/types';

export type SimulatedBoardState = {
  games: EspnNormalizedGame[];
  context: ScoresFetchContext;
};

export function parseFixtureGame(raw: Record<string, unknown>): EspnNormalizedGame {
  const parsed = parseEspnScoreboardNormalized(raw);
  if (parsed.games.length === 0) {
    throw new Error(parsed.message ?? 'Fixture produced no games');
  }
  return parsed.games[0];
}

export function createSimulatedBoard(
  context: ScoresFetchContext = { weekId: 'week-8', leagueFilter: 'fcs' },
): SimulatedBoardState {
  return { games: [], context };
}

/** Apply a parsed fixture payload to the board (same rules as Scores visible update). */
export function applyFixtureToBoard(
  board: SimulatedBoardState,
  raw: Record<string, unknown>,
  options?: { isCurrent?: boolean },
): SimulatedBoardState {
  const parsed = parseEspnScoreboardNormalized(raw);
  const update = resolveScoresVisibleUpdate({
    isCurrent: options?.isCurrent ?? true,
    fetchedGames: parsed.games,
    previousGames: board.games,
    previousContext: board.games.length > 0 ? board.context : null,
    requestContext: board.context,
  });

  if (update.type === 'preserve' || update.type === 'ignore') {
    return board;
  }

  return {
    ...board,
    games: update.games,
  };
}

export function summarizeSimulatedGame(game: EspnNormalizedGame | undefined): {
  awayScore: number | undefined;
  homeScore: number | undefined;
  normalizedStatus: EspnNormalizedGame['normalizedStatus'];
  displayStatus: string;
  shouldPoll: boolean;
  isLiveVisible: boolean;
} {
  if (!game) {
    return {
      awayScore: undefined,
      homeScore: undefined,
      normalizedStatus: undefined,
      displayStatus: '',
      shouldPoll: false,
      isLiveVisible: false,
    };
  }

  return {
    awayScore: game.awayScore,
    homeScore: game.homeScore,
    normalizedStatus: game.normalizedStatus,
    displayStatus: formatEspnGameStatusLabel(game),
    shouldPoll: shouldPollEspnNormalizedStatus(game.normalizedStatus),
    isLiveVisible: hasLiveEspnNormalizedGames([game]),
  };
}

export { createScoresRequestGeneration, resolveScoresVisibleUpdate };
