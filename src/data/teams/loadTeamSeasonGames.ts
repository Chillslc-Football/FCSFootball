import { espnScoresProvider } from '@/data/providers/espnProvider';
import { SCORES_WEEK_OPTIONS } from '@/data/providers/espnScheduleWeek';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import { ncaaRankingsProvider } from '@/data/providers/ncaaRankingsProvider';
import {
  getAllCachedEspnGames,
  registerEspnGames,
} from '@/data/teams/teamGamesStore';
import type { EspnDivisionHint, EspnNormalizedGame } from '@/types';
import {
  gameIncludesTeamKey,
  getTeamSideInGame,
  isEspnTeamId,
  slugifyTeamName,
} from '@/utils/teamId';
import { sortEspnNormalizedGames } from '@/utils/sortGames';

export type TeamProfile = {
  routeId: string;
  espnTeamId?: string;
  /** Full ESPN displayName */
  name: string;
  displayName: string;
  location?: string;
  mascot?: string;
  abbreviation?: string;
  logoUrl?: string;
  conference?: string;
  record?: string;
  rank?: number;
  division?: EspnDivisionHint;
};

export type TeamSeasonData = {
  profile: TeamProfile;
  games: EspnNormalizedGame[];
};

let seasonLoadPromise: Promise<EspnNormalizedGame[]> | null = null;

/** Clear the session-level team schedule batch loader so the next load refetches. */
export function resetSeasonGamesLoad(): void {
  seasonLoadPromise = null;
}

/** Fetch all configured ESPN scoreboard weeks once per session and merge into cache. */
export async function ensureSeasonGamesLoaded(options?: {
  forceRefresh?: boolean;
}): Promise<EspnNormalizedGame[]> {
  if (options?.forceRefresh) {
    seasonLoadPromise = null;
  }

  if (seasonLoadPromise) {
    return seasonLoadPromise;
  }

  seasonLoadPromise = (async () => {
    try {
      const existing = options?.forceRefresh ? [] : getAllCachedEspnGames();
      const seen = new Set(existing.map((game) => game.id));
      const collected: EspnNormalizedGame[] = [...existing];

      const responses = await Promise.all(
        SCORES_WEEK_OPTIONS.map((option) =>
          espnScoresProvider
            .getWeekGames(option.id, { forceRefresh: options?.forceRefresh })
            .catch(() => null),
        ),
      );

      for (const response of responses) {
        if (!response) continue;
        for (const game of response.data.games) {
          if (seen.has(game.id)) continue;
          seen.add(game.id);
          collected.push(game);
        }
      }

      const merged = await mergeStaticRankingsOntoGames(collected);
      registerEspnGames(merged.games);
      return merged.games;
    } catch (error) {
      console.warn('[ensureSeasonGamesLoaded] failed:', error);
      seasonLoadPromise = null;
      return getAllCachedEspnGames();
    }
  })();

  return seasonLoadPromise;
}

async function lookupStaticPollTeam(teamKey: string): Promise<Partial<TeamProfile>> {
  const key = decodeURIComponent(teamKey).toLowerCase();
  const response = await ncaaRankingsProvider.getTop25();

  const match = response.data.teams.find((entry) => {
    const slug = slugifyTeamName(entry.team.name);
    return entry.team.id === key || slug === key;
  });

  if (!match) return {};

  return {
    name: match.team.name,
    displayName: match.team.name,
    abbreviation: match.team.abbreviation,
    rank: match.rank,
    record: `${match.record.wins}-${match.record.losses}`,
  };
}

function buildProfileFromGame(
  game: EspnNormalizedGame,
  side: 'away' | 'home',
  routeId: string,
): TeamProfile {
  const isAway = side === 'away';

  return {
    routeId,
    espnTeamId: isAway ? game.awayTeamId : game.homeTeamId,
    name: isAway ? game.awayTeam : game.homeTeam,
    displayName: isAway ? game.awayTeam : game.homeTeam,
    location: isAway ? game.awayLocation : game.homeLocation,
    mascot: isAway ? game.awayMascot : game.homeMascot,
    abbreviation: isAway ? game.awayAbbreviation : game.homeAbbreviation,
    logoUrl: isAway ? game.awayLogoUrl : game.homeLogoUrl,
    conference: isAway ? game.awayConference : game.homeConference,
    record: isAway ? game.awayRecord : game.homeRecord,
    rank: isAway
      ? game.awayIsRanked
        ? game.awayRank
        : undefined
      : game.homeIsRanked
        ? game.homeRank
        : undefined,
    division: isAway ? game.awayDivision : game.homeDivision,
  };
}

function resolveTeamProfile(
  teamKey: string,
  games: EspnNormalizedGame[],
  staticFallback: Partial<TeamProfile>,
): TeamProfile {
  const routeId = decodeURIComponent(teamKey);

  for (const game of games) {
    const side = getTeamSideInGame(game, routeId);
    if (!side) continue;
    const profile = buildProfileFromGame(game, side, routeId);
    return {
      ...profile,
      rank: profile.rank ?? staticFallback.rank,
      record: profile.record ?? staticFallback.record,
    };
  }

  return {
    routeId,
    espnTeamId: isEspnTeamId(routeId) ? routeId : staticFallback.espnTeamId,
    name: staticFallback.name ?? routeId,
    displayName: staticFallback.displayName ?? staticFallback.name ?? routeId,
    location: staticFallback.location,
    mascot: staticFallback.mascot,
    abbreviation: staticFallback.abbreviation,
    logoUrl: staticFallback.logoUrl,
    conference: staticFallback.conference,
    record: staticFallback.record,
    rank: staticFallback.rank,
    division: staticFallback.division,
  };
}

export async function loadTeamSeasonData(
  teamKey: string,
  options?: { forceRefresh?: boolean },
): Promise<TeamSeasonData> {
  const routeId = decodeURIComponent(teamKey);
  const staticFallback = await lookupStaticPollTeam(routeId);
  const allGames = await ensureSeasonGamesLoaded({
    forceRefresh: options?.forceRefresh,
  });

  const teamGames = sortEspnNormalizedGames(
    allGames.filter((game) => gameIncludesTeamKey(game, routeId)),
  );

  const profile = resolveTeamProfile(routeId, teamGames, staticFallback);

  return { profile, games: teamGames };
}

export const TEAM_SCHEDULE_SOURCE_NOTE =
  'Team schedule is based on currently loaded ESPN game data.';
