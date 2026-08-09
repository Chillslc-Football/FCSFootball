import type { EspnNormalizedGame } from '@/types';
import type { FavoriteTeam } from '@/types/favorites';
import { gameIncludesTeamKey, getTeamSideInGame } from '@/utils/teamId';

export type TeamNextGameInfo = {
  game: EspnNormalizedGame;
  opponent: string;
  isHome: boolean;
};

function resolveTeamKey(favorite: FavoriteTeam): string | null {
  const key = favorite.espnTeamId?.trim() || favorite.key?.trim();
  return key || null;
}

/** Opponent label for a favorite team's game, e.g. "vs Montana" or "@ North Dakota". */
export function formatNextGameOpponent(
  game: EspnNormalizedGame,
  teamKey: string,
): string {
  try {
    const side = getTeamSideInGame(game, teamKey);
    if (side === 'away') {
      const opponent = game.homeShortDisplayName ?? game.homeTeam;
      return `@ ${opponent}`;
    }
    if (side === 'home') {
      const opponent = game.awayShortDisplayName ?? game.awayTeam;
      return `vs ${opponent}`;
    }
    return 'TBD';
  } catch (error) {
    console.warn('[findNextTeamGame] formatNextGameOpponent failed:', error);
    return 'TBD';
  }
}

/**
 * Next relevant game for a favorite team from loaded ESPN season data.
 * Prefers live games, then earliest upcoming; ignores completed games.
 */
export function findNextTeamGame(
  favorite: FavoriteTeam,
  allGames: EspnNormalizedGame[],
): TeamNextGameInfo | null {
  try {
    const teamKey = resolveTeamKey(favorite);
    if (!teamKey || !Array.isArray(allGames) || allGames.length === 0) return null;

    const teamGames = allGames.filter((game) => gameIncludesTeamKey(game, teamKey));
    if (teamGames.length === 0) return null;

    const live = teamGames.find(
      (game) =>
        game.normalizedStatus === 'in_progress' ||
        game.normalizedStatus === 'delayed' ||
        game.normalizedStatus === 'suspended',
    );
    const candidate =
      live ??
      teamGames
        .filter(
          (game) =>
            game.normalizedStatus !== 'final' && game.normalizedStatus !== 'cancelled',
        )
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))[0];

    if (!candidate) return null;

    const side = getTeamSideInGame(candidate, teamKey);
    return {
      game: candidate,
      opponent: formatNextGameOpponent(candidate, teamKey),
      isHome: side === 'home',
    };
  } catch (error) {
    console.warn('[findNextTeamGame] findNextTeamGame failed:', error);
    return null;
  }
}

/** Refresh rank/record on a favorite from the most recent loaded ESPN game. */
export function enrichFavoriteTeam(
  favorite: FavoriteTeam,
  allGames: EspnNormalizedGame[],
): FavoriteTeam {
  try {
    const teamKey = resolveTeamKey(favorite);
    if (!teamKey || !Array.isArray(allGames) || allGames.length === 0) return favorite;

    const teamGames = allGames
      .filter((game) => gameIncludesTeamKey(game, teamKey))
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

    if (teamGames.length === 0) return favorite;

    const latest = teamGames[teamGames.length - 1];
    const side = getTeamSideInGame(latest, teamKey);
    if (!side) return favorite;

    const record =
      side === 'away' ? latest.awayRecord?.trim() : latest.homeRecord?.trim();
    const rank =
      side === 'away'
        ? latest.awayIsRanked
          ? latest.awayRank
          : undefined
        : latest.homeIsRanked
          ? latest.homeRank
          : undefined;

    // Same label as ScoresGameCard: shortDisplayName ?? full ESPN name (display only).
    const scoresDisplayName =
      side === 'away'
        ? (latest.awayShortDisplayName ?? latest.awayTeam)
        : (latest.homeShortDisplayName ?? latest.homeTeam);

    return {
      ...favorite,
      shortDisplayName: scoresDisplayName?.trim() || favorite.shortDisplayName,
      record: record || favorite.record,
      rank: rank ?? favorite.rank,
      abbreviation:
        (side === 'away' ? latest.awayAbbreviation : latest.homeAbbreviation) ??
        favorite.abbreviation,
      logoUrl: (side === 'away' ? latest.awayLogoUrl : latest.homeLogoUrl) ?? favorite.logoUrl,
      conference:
        (side === 'away' ? latest.awayConference : latest.homeConference) ?? favorite.conference,
    };
  } catch (error) {
    console.warn('[findNextTeamGame] enrichFavoriteTeam failed:', error);
    return favorite;
  }
}
