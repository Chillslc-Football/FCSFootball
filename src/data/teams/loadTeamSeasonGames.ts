import { espnScoresProvider } from '@/data/providers/espnProvider';
import { SCORES_WEEK_OPTIONS } from '@/data/providers/espnScheduleWeek';
import { loadNcaaRankingsForEnrichment } from '@/data/providers/ncaaRankingsEnrichment';
import { mergeStaticRankingsOntoGames } from '@/data/providers/rankingMerge';
import {
  refreshCurrentWeekGamesIntoSeason,
  resolveSeasonRefreshMode,
} from '@/data/teams/seasonGamesRefresh';
import {
  collectGamesFromWeekResults,
  fetchSeasonWeekWithRetry,
  pickTeamProfileSourceGame,
  shouldRetryFailedSeasonWeeks,
  type SeasonWeekFetchResult,
} from '@/data/teams/seasonWeekLoad';
import {
  getAllCachedEspnGames,
  registerEspnGames,
} from '@/data/teams/teamGamesStore';
import type {
  EspnDivisionHint,
  EspnNormalizedGame,
  NcaaRankingsPayload,
  ScheduleWeekId,
} from '@/types';
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
  /** True when one or more season weeks failed after retry. */
  isPartialSchedule: boolean;
  failedWeekIds: ScheduleWeekId[];
};

let seasonLoadPromise: Promise<EspnNormalizedGame[]> | null = null;
/** Weeks that still failed after retry — retried on non-live season/focus loads. */
let failedSeasonWeekIds: ScheduleWeekId[] = [];

export function getSeasonSchedulePartialState(): {
  isPartial: boolean;
  failedWeekIds: ScheduleWeekId[];
} {
  return {
    isPartial: failedSeasonWeekIds.length > 0,
    failedWeekIds: [...failedSeasonWeekIds],
  };
}

/** Test/helper — seed partial-week tracking. */
export function setFailedSeasonWeekIdsForTests(weekIds: ScheduleWeekId[]): void {
  failedSeasonWeekIds = [...weekIds];
}

/** Clear the session-level team schedule batch loader so the next load refetches. */
export function resetSeasonGamesLoad(): void {
  seasonLoadPromise = null;
  failedSeasonWeekIds = [];
}

async function fetchWeekGames(weekId: ScheduleWeekId, forceRefresh?: boolean): Promise<EspnNormalizedGame[]> {
  const response = await espnScoresProvider.getWeekGames(weekId, { forceRefresh });
  return response.data.games;
}

async function loadVisibleSeasonWeeks(options?: {
  forceRefresh?: boolean;
  weekIds?: ScheduleWeekId[];
}): Promise<SeasonWeekFetchResult[]> {
  const weekIds =
    options?.weekIds ?? SCORES_WEEK_OPTIONS.map((option) => option.id as ScheduleWeekId);

  return Promise.all(
    weekIds.map((weekId) =>
      fetchSeasonWeekWithRetry({
        weekId,
        fetchWeek: (id) => fetchWeekGames(id, options?.forceRefresh),
      }),
    ),
  );
}

/** Retry only weeks that previously failed — never used on 30s live ticks. */
export async function retryFailedSeasonWeeks(options?: {
  forceRefresh?: boolean;
}): Promise<{
  recoveredWeekIds: ScheduleWeekId[];
  failedWeekIds: ScheduleWeekId[];
  isPartial: boolean;
}> {
  const pending = [...failedSeasonWeekIds];
  if (pending.length === 0) {
    return { recoveredWeekIds: [], failedWeekIds: [], isPartial: false };
  }

  const results = await loadVisibleSeasonWeeks({
    forceRefresh: options?.forceRefresh ?? true,
    weekIds: pending,
  });

  const recoveredWeekIds: ScheduleWeekId[] = [];
  const stillFailed: ScheduleWeekId[] = [];

  for (const result of results) {
    if (result.failed || !result.games) {
      stillFailed.push(result.weekId);
      continue;
    }
    recoveredWeekIds.push(result.weekId);
    const ranked = await mergeStaticRankingsOntoGames(result.games);
    registerEspnGames(ranked.games);
  }

  failedSeasonWeekIds = stillFailed;
  if (stillFailed.length > 0) {
    console.warn(
      '[retryFailedSeasonWeeks] still partial after retry:',
      stillFailed.join(', '),
    );
  }

  return {
    recoveredWeekIds,
    failedWeekIds: stillFailed,
    isPartial: stillFailed.length > 0,
  };
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
      const results = await loadVisibleSeasonWeeks({
        forceRefresh: options?.forceRefresh,
      });
      const collected = collectGamesFromWeekResults(results, existing);
      failedSeasonWeekIds = collected.failedWeekIds;

      if (collected.isPartial) {
        console.warn(
          '[ensureSeasonGamesLoaded] partial season schedule; failed weeks:',
          collected.failedWeekIds.join(', '),
        );
      }

      // Rankings are optional — never lose collected weeks if merge degrades.
      let gamesForStore = collected.games;
      try {
        const merged = await mergeStaticRankingsOntoGames(collected.games);
        gamesForStore = merged.games;
      } catch (rankError) {
        console.warn(
          '[ensureSeasonGamesLoaded] ranking merge failed (non-fatal); keeping unranked games:',
          rankError,
        );
      }
      registerEspnGames(gamesForStore);

      // Allow a later season load / failed-week retry to refill gaps.
      if (collected.isPartial) {
        seasonLoadPromise = null;
      }

      // Prefer the full in-memory store so a force-refresh that fails one week
      // still keeps previously cached games for that week (no wipe).
      return getAllCachedEspnGames();
    } catch (error) {
      console.warn('[ensureSeasonGamesLoaded] failed:', error);
      seasonLoadPromise = null;
      return getAllCachedEspnGames();
    }
  })();

  return seasonLoadPromise;
}

/** Map optional poll payload → team profile fields (rank/record/name). Never throws. */
export function matchStaticPollTeamFromPayload(
  teamKey: string,
  payload: NcaaRankingsPayload | null | undefined,
): Partial<TeamProfile> {
  if (!payload?.teams?.length) return {};

  const key = decodeURIComponent(teamKey).toLowerCase();
  const match = payload.teams.find((entry) => {
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

async function lookupStaticPollTeam(
  teamKey: string,
  options?: {
    loadRankings?: () => Promise<NcaaRankingsPayload | null>;
  },
): Promise<Partial<TeamProfile>> {
  try {
    const payload = await (options?.loadRankings ?? loadNcaaRankingsForEnrichment)();
    return matchStaticPollTeamFromPayload(teamKey, payload);
  } catch (error) {
    console.warn('[lookupStaticPollTeam] rankings unavailable (non-fatal):', error);
    return {};
  }
}

async function resolveSeasonGamesForTeam(options?: {
  forceRefresh?: boolean;
  currentWeekOnly?: boolean;
  trigger?: string;
  pullRefresh?: boolean;
}): Promise<EspnNormalizedGame[]> {
  const refreshMode = resolveSeasonRefreshMode({
    pullRefresh: options?.pullRefresh,
    currentWeekOnly: options?.currentWeekOnly,
    trigger: options?.trigger,
    hasSeasonCache: getAllCachedEspnGames().length > 0,
  });

  if (refreshMode === 'current-week') {
    const refreshed = await refreshCurrentWeekGamesIntoSeason({
      forceRefresh: options?.forceRefresh ?? true,
    });
    let allGames = refreshed.allGames;

    // Fill cold-load gaps on focus / app-active / PTR — not on 30s live ticks.
    if (shouldRetryFailedSeasonWeeks(options?.trigger)) {
      await retryFailedSeasonWeeks({ forceRefresh: true });
      allGames = getAllCachedEspnGames();
    }
    return allGames;
  }

  return ensureSeasonGamesLoaded({
    forceRefresh: options?.forceRefresh,
  });
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

export function resolveTeamProfile(
  teamKey: string,
  games: EspnNormalizedGame[],
  staticFallback: Partial<TeamProfile>,
): TeamProfile {
  const routeId = decodeURIComponent(teamKey);
  const source = pickTeamProfileSourceGame(games, routeId);

  if (source) {
    const side = getTeamSideInGame(source, routeId);
    if (side) {
      const profile = buildProfileFromGame(source, side, routeId);
      return {
        ...profile,
        rank: profile.rank ?? staticFallback.rank,
        record: profile.record ?? staticFallback.record,
      };
    }
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
  options?: {
    forceRefresh?: boolean;
    currentWeekOnly?: boolean;
    trigger?: string;
    pullRefresh?: boolean;
    /** Test override — rankings enrichment (optional; failures must not fail page). */
    loadRankings?: () => Promise<NcaaRankingsPayload | null>;
    /** Test override — season/schedule games loader. */
    loadSeasonGames?: () => Promise<EspnNormalizedGame[]>;
  },
): Promise<TeamSeasonData> {
  const routeId = decodeURIComponent(teamKey);

  // Rankings enrichment runs in parallel with schedule and is never fatal.
  const [staticFallback, allGames] = await Promise.all([
    lookupStaticPollTeam(routeId, { loadRankings: options?.loadRankings }),
    options?.loadSeasonGames
      ? options.loadSeasonGames()
      : resolveSeasonGamesForTeam(options),
  ]);

  const teamGames = sortEspnNormalizedGames(
    allGames.filter((game) => gameIncludesTeamKey(game, routeId)),
  );

  const profile = resolveTeamProfile(routeId, teamGames, staticFallback);
  const partial = getSeasonSchedulePartialState();

  return {
    profile,
    games: teamGames,
    isPartialSchedule: partial.isPartial,
    failedWeekIds: partial.failedWeekIds,
  };
}

export const TEAM_SCHEDULE_SOURCE_NOTE =
  'Schedule & results are based on ESPN game data.';

export const TEAM_SCHEDULE_PARTIAL_NOTE =
  'Some schedule data may still be updating.';
