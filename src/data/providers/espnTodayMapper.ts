import type {
  EspnNormalizedGame,
  GameStatus,
  ScoreboardGame,
  ScoreboardTeam,
  UpsetAlertLabel,
  UpsetWatchGame,
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

function toScoreboardTeam(
  name: string,
  teamId: string | undefined,
  gameId: string,
  side: 'away' | 'home',
): ScoreboardTeam {
  return {
    id: teamId ?? `${gameId}-${side}`,
    name,
    abbreviation: abbreviateTeamName(name),
  };
}

export function toGameStatus(game: EspnNormalizedGame): GameStatus {
  switch (game.normalizedStatus) {
    case 'in_progress':
      return 'live';
    case 'final':
      return 'final';
    default:
      return 'upcoming';
  }
}

export function formatKickoffTime(startTime: string): string {
  if (!startTime || startTime === 'TBD') return 'TBD';
  const parsed = Date.parse(startTime);
  if (Number.isNaN(parsed)) return startTime;
  return new Date(parsed).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function toScoreboardGame(game: EspnNormalizedGame): ScoreboardGame {
  const status = toGameStatus(game);
  const kickoff = formatKickoffTime(game.startTime);

  return {
    id: game.id,
    awayTeam: toScoreboardTeam(game.awayTeam, game.awayTeamId, game.id, 'away'),
    homeTeam: toScoreboardTeam(game.homeTeam, game.homeTeamId, game.id, 'home'),
    status,
    awayScore: game.awayScore,
    homeScore: game.homeScore,
    statusDetail: status === 'upcoming' ? kickoff : game.status,
    broadcast: game.broadcast ?? '—',
  };
}

function isFcsFbsMatchup(game: EspnNormalizedGame): boolean {
  const awayFcs = game.awayDivision === 'fcs';
  const awayFbs = game.awayDivision === 'fbs';
  const homeFcs = game.homeDivision === 'fcs';
  const homeFbs = game.homeDivision === 'fbs';
  return (awayFcs && homeFbs) || (awayFbs && homeFcs);
}

function computeUpsetAlert(
  fcsScore: number,
  fbsScore: number,
  status: GameStatus,
): UpsetAlertLabel | null {
  if (status !== 'live' && status !== 'final') return null;

  const diff = Math.abs(fcsScore - fbsScore);

  if (status === 'final' && fcsScore > fbsScore) return 'FCS Win';
  if (fcsScore > fbsScore) return 'FCS Leading';
  if (diff <= 7) return diff === 0 ? 'Upset Alert' : 'One Score Game';
  return null;
}

export function toUpsetWatchGame(game: EspnNormalizedGame): UpsetWatchGame | null {
  if (!isFcsFbsMatchup(game)) return null;

  const status = toGameStatus(game);
  if (status !== 'live' && status !== 'final') return null;

  const awayScore = game.awayScore ?? 0;
  const homeScore = game.homeScore ?? 0;

  const fcsIsAway = game.awayDivision === 'fcs';
  const fcsTeam = fcsIsAway ? game.awayTeam : game.homeTeam;
  const fbsTeam = fcsIsAway ? game.homeTeam : game.awayTeam;
  const fcsTeamId = fcsIsAway ? game.awayTeamId : game.homeTeamId;
  const fbsTeamId = fcsIsAway ? game.homeTeamId : game.awayTeamId;
  const fcsScore = fcsIsAway ? awayScore : homeScore;
  const fbsScore = fcsIsAway ? homeScore : awayScore;

  const alertLabel = computeUpsetAlert(fcsScore, fbsScore, status);
  if (!alertLabel) return null;

  return {
    id: game.id,
    fcsTeam: {
      id: fcsTeamId ?? `${game.id}-fcs`,
      name: fcsTeam,
      abbreviation: abbreviateTeamName(fcsTeam),
      division: 'fcs',
    },
    fbsTeam: {
      id: fbsTeamId ?? `${game.id}-fbs`,
      name: fbsTeam,
      abbreviation: abbreviateTeamName(fbsTeam),
      division: 'fbs',
    },
    fcsScore,
    fbsScore,
    status,
    statusDetail: status === 'live' ? game.status : game.status,
    alertLabel,
    broadcast: game.broadcast ?? '—',
  };
}

/** Prefer live, then upcoming, then final for featured slot. */
export function pickFeaturedGame(games: EspnNormalizedGame[]): EspnNormalizedGame | null {
  if (games.length === 0) return null;
  const live = games.find((g) => g.normalizedStatus === 'in_progress');
  if (live) return live;
  const upcoming = games.find((g) => g.normalizedStatus === 'scheduled');
  if (upcoming) return upcoming;
  return games[0];
}

export function filterUpsetWatchGames(games: EspnNormalizedGame[]): UpsetWatchGame[] {
  return games
    .map(toUpsetWatchGame)
    .filter((g): g is UpsetWatchGame => g != null);
}
