import { formatKickoffTime, toGameStatus } from '@/data/providers/espnTodayMapper';
import type {
  EspnNormalizedGame,
  ScheduleGame,
  ScheduleMatchupType,
  ScheduleTeam,
  TeamDivision,
} from '@/types';

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
  name: string,
  teamId: string | undefined,
  gameId: string,
  side: 'away' | 'home',
  division: EspnNormalizedGame['awayDivision'],
  conference?: string,
): ScheduleTeam {
  return {
    id: teamId ?? `${gameId}-${side}`,
    name,
    abbreviation: abbreviateTeamName(name),
    division: toDivision(division),
    conference,
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
  if (!startTime || startTime === 'TBD') return 'unknown';
  const parsed = Date.parse(startTime);
  if (Number.isNaN(parsed)) return 'unknown';
  const d = new Date(parsed);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatScheduleDateLabel(isoDate: string): string {
  if (isoDate === 'unknown') return 'Date TBD';
  const parsed = Date.parse(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed)) return isoDate;
  return new Date(parsed).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function toScheduleGame(game: EspnNormalizedGame): ScheduleGame {
  const status = toGameStatus(game);
  const kickoff = formatKickoffTime(game.startTime);
  const showScores = status === 'live' || status === 'final';

  return {
    id: game.id,
    date: extractGameDateIso(game.startTime),
    time: kickoff,
    awayTeam: toScheduleTeam(
      game.awayTeam,
      game.awayTeamId,
      game.id,
      'away',
      game.awayDivision,
      game.awayConference,
    ),
    homeTeam: toScheduleTeam(
      game.homeTeam,
      game.homeTeamId,
      game.id,
      'home',
      game.homeDivision,
      game.homeConference,
    ),
    broadcast: game.broadcast ?? '—',
    conference: pickConference(game),
    matchupType: getMatchupType(game),
    venue: game.venue,
    status,
    awayScore: showScores ? game.awayScore : undefined,
    homeScore: showScores ? game.homeScore : undefined,
    statusDetail: status === 'upcoming' ? kickoff : game.status,
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
      games: dateGames.sort((a, b) => a.time.localeCompare(b.time)),
    }));
}
