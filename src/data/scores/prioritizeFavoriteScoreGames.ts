import type { FavoriteTeam } from '@/types/favorites';
import type { EspnNormalizedGame } from '@/types';
import { gameIncludesTeamKey } from '@/utils/teamId';

export function gameInvolvesFavoriteTeam(
  game: EspnNormalizedGame,
  favorites: FavoriteTeam[],
): boolean {
  if (favorites.length === 0) return false;

  return favorites.some((favorite) => {
    const teamKey = favorite.espnTeamId ?? favorite.key;
    return gameIncludesTeamKey(game, teamKey);
  });
}

/**
 * Stable partition: favorite games first, then all others.
 * Preserves the relative order within each bucket.
 */
export function prioritizeFavoriteScoreGames(
  orderedGames: readonly EspnNormalizedGame[],
  favorites: FavoriteTeam[],
): { favoriteGames: EspnNormalizedGame[]; otherGames: EspnNormalizedGame[] } {
  if (favorites.length === 0) {
    return { favoriteGames: [], otherGames: [...orderedGames] };
  }

  const favoriteGames: EspnNormalizedGame[] = [];
  const otherGames: EspnNormalizedGame[] = [];

  for (const game of orderedGames) {
    if (gameInvolvesFavoriteTeam(game, favorites)) {
      favoriteGames.push(game);
    } else {
      otherGames.push(game);
    }
  }

  return { favoriteGames, otherGames };
}

/**
 * Stable partition within one ordered list: favorites first, then all others.
 * Returns a new array — does not mutate the input.
 */
export function prioritizeFavoriteGamesWithinOrder(
  orderedGames: readonly EspnNormalizedGame[],
  favorites: FavoriteTeam[],
): EspnNormalizedGame[] {
  const { favoriteGames, otherGames } = prioritizeFavoriteScoreGames(orderedGames, favorites);
  return [...favoriteGames, ...otherGames];
}
