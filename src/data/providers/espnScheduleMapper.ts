import { toGameStatus } from '@/data/providers/espnTodayMapper';
import type {
  EspnNormalizedGame,
  ScheduleGame,
  ScheduleMatchupType,
  ScheduleTeam,
  TeamDivision,
} from '@/types';
import { getCompactTeamDisplayName } from '@/utils/teamDisplay';
import {
  extractLocalGameDateIso,
  formatGameDateLabel,
} from '@/utils/formatGameTime';
import { sortScheduleGames } from '@/utils/sortGames';

function abbreviateTeamName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase();
  return parts
    .map((p) => p[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
}

function toDivision(hint: EspnNormalizedGame['awayDivision']): TeamDivision {
  return hint === 'fbs' ? 'fbs' : 'fcs';
}

function toScheduleTeam(
  fullName: string,
  teamId: string | undefined,
  gameId: string,
  side: 'away' | 'home',
  division: EspnNormalizedGame['awayDivision'],
  conference?: string,
  rank?: number,
  abbreviation?: string,
  logoUrl?: string,
  record?: string,
  shortDisplayName?: string,
): ScheduleTeam {
  return {
    id: teamId ?? `${gameId}-${side}`,
    name: getCompactTeamDisplayName({
      shortDisplayName,
      abbreviation,
      displayName: fullName,
    }),
    fullName,
    abbreviation: abbreviation ?? abbreviateTeamName(fullName),
    logoUrl,
    division: toDivision(division),
    conference,
    rank,
    record,
  };
}

function getMatchupType(game: EspnNormalizedGame): ScheduleMatchupType {
  const awayFcs = game.awayDivision === 'fcs';
  const awayFbs = game.awayDivision === 'fbs';
  const homeFcs = game.homeDivision === 'fcs';
  const homeFbs = game.homeDivision === 'fbs';
  if ((awayFcs && homeFbs) || (awayFbs && homeFcs)) return 'fcs-fbs';
  return 'fcs-fcs';
}

function pickConference(game: EspnNormalizedGame): string | undefined {
  if (game.awayConference && game.homeConference) {
    if (game.awayConference === game.homeConference) return game.awayConference;
    return `${game.awayConference} / ${game.homeConference}`;
  }
  return game.awayConference ?? game.homeConference ?? game.groupInfo;
}

/** Extract YYYY-MM-DD from ESPN startTime in local calendar. */
export function extractGameDateIso(startTime: string): string {
  return extractLocalGameDateIso(startTime);
}

export function formatScheduleDateLabel(isoDate: string): string {
  return formatGameDateLabel(isoDate);
}

export function toScheduleGame(game: EspnNormalizedGame): ScheduleGame {
  const status = toGameStatus(game);
  const showScores = status === 'live' || status === 'final';

  return {
    id: game.id,
    date: extractLocalGameDateIso(game.startTime),
    startTime: game.startTime,
    time: '',
    awayTeam: toScheduleTeam(
      game.awayTeam,
      game.awayTeamId,
      game.id,
      'away',
      game.awayDivision,
      game.awayConference,
      game.awayRank,
      game.awayAbbreviation,
      game.awayLogoUrl,
      game.awayRecord,
      game.awayShortDisplayName,
    ),
    homeTeam: toScheduleTeam(
      game.homeTeam,
      game.homeTeamId,
      game.id,
      'home',
      game.homeDivision,
      game.homeConference,
      game.homeRank,
      game.homeAbbreviation,
      game.homeLogoUrl,
      game.homeRecord,
      game.homeShortDisplayName,
    ),
    broadcast: game.broadcast ?? '—',
    conference: pickConference(game),
    matchupType: getMatchupType(game),
    venue: game.venue,
    status,
    awayScore: showScores ? game.awayScore : undefined,
    homeScore: showScores ? game.homeScore : undefined,
    statusDetail: game.status,
    awayRecord: game.awayRecord,
    homeRecord: game.homeRecord,
  };
}

export type ScheduleDateGroup = {
  date: string;
  label: string;
  games: ScheduleGame[];
};

export function groupScheduleGamesByDate(games: EspnNormalizedGame[]): ScheduleDateGroup[] {
  const scheduleGames = games.map(toScheduleGame);

  const byDate = new Map<string, ScheduleGame[]>();
  for (const game of scheduleGames) {
    const bucket = byDate.get(game.date) ?? [];
    bucket.push(game);
    byDate.set(game.date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b);
    })
    .map(([date, dateGames]) => ({
      date,
      label: formatScheduleDateLabel(date),
      games: sortScheduleGames(dateGames),
    }));
}
