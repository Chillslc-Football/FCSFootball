import {
  extractEspnScoreboardDate,
  parseEspnScoreboardNormalized,
  toRawRecord,
} from '@/data/providers/espnParser';
import type { EspnScoreboardParseResult } from '@/data/providers/espnParser';
import type { EspnNormalizedGame } from '@/types';

export {
  ESPN_FCS_SCOREBOARD_URL,
  EspnScoresProviderImpl,
  espnScoresProvider,
  espnProvider,
  EspnProvider,
} from '@/data/providers/espnProvider';

/**
 * Parse raw ESPN scoreboard JSON into normalized game objects.
 * Phase 6E — no network, no production wiring.
 */
export function parseEspnScoreboardGames(raw: unknown): EspnScoreboardParseResult {
  return parseEspnScoreboardNormalized(raw);
}

export type { EspnScoreboardParseResult, EspnNormalizedGame };

export { extractEspnScoreboardDate, toRawRecord };
