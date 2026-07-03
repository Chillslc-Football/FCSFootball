import type { EspnNormalizedGame } from '@/types';

const gamesById = new Map<string, EspnNormalizedGame>();

/** Merge normalized ESPN games into the in-memory season cache. */
export function registerEspnGames(games: EspnNormalizedGame[]): void {
  for (const game of games) {
    gamesById.set(game.id, game);
  }
}

export function getAllCachedEspnGames(): EspnNormalizedGame[] {
  return [...gamesById.values()];
}

export function getCachedEspnGame(gameId: string): EspnNormalizedGame | undefined {
  return gamesById.get(gameId);
}

export function clearTeamGamesCache(): void {
  gamesById.clear();
}
