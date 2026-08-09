import type {
  EspnNormalizedGame,
  GameStatus,
  ScoreboardGame,
  ScoreboardTeam,
  UpsetAlertLabel,
  UpsetWatchGame,
} from '@/types';
import { getCompactTeamDisplayName } from '@/utils/teamDisplay';

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
  fullName: string,
  teamId: string | undefined,
  gameId: string,
  side: 'away' | 'home',
  rank?: number,
  abbreviation?: string,
  logoUrl?: string,
  record?: string,
  shortDisplayName?: string,
): ScoreboardTeam {
  const compactName = getCompactTeamDisplayName({
    shortDisplayName,
    abbreviation,
    displayName: fullName,
  });

  return {
    id: teamId ?? `${gameId}-${side}`,
    name: compactName,
    fullName,
    abbreviation: abbreviation ?? abbreviateTeamName(fullName),
    logoUrl,
    rank,
    record,
  };
}

export function toGameStatus(game: EspnNormalizedGame): GameStatus {
  switch (game.normalizedStatus) {
    case 'in_progress':
    case 'delayed':
    case 'suspended':
      return 'live';
    case 'final':
      return 'final';
    default:
      // postponed / cancelled / scheduled → not final; cards use ESPN status text where needed
      return 'upcoming';
  }
}

export { formatKickoffTime } from '@/utils/formatGameTime';

export function toScoreboardGame(game: EspnNormalizedGame): ScoreboardGame {
  const status = toGameStatus(game);

  return {
    id: game.id,
    awayTeam: toScoreboardTeam(
      game.awayTeam,
      game.awayTeamId,
      game.id,
      'away',
      game.awayRank,
      game.awayAbbreviation,
      game.awayLogoUrl,
      game.awayRecord,
      game.awayShortDisplayName,
    ),
    homeTeam: toScoreboardTeam(
      game.homeTeam,
      game.homeTeamId,
      game.id,
      'home',
      game.homeRank,
      game.homeAbbreviation,
      game.homeLogoUrl,
      game.homeRecord,
      game.homeShortDisplayName,
    ),
    status,
    awayScore: game.awayScore,
    homeScore: game.homeScore,
    startTime: game.startTime,
    statusDetail: game.status,
    broadcast: game.broadcast ?? '—',
    awayRecord: game.awayRecord,
    homeRecord: game.homeRecord,
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
  const fcsFullName = fcsIsAway ? game.awayTeam : game.homeTeam;
  const fbsFullName = fcsIsAway ? game.homeTeam : game.awayTeam;
  const fcsTeamId = fcsIsAway ? game.awayTeamId : game.homeTeamId;
  const fbsTeamId = fcsIsAway ? game.homeTeamId : game.awayTeamId;
  const fcsScore = fcsIsAway ? awayScore : homeScore;
  const fbsScore = fcsIsAway ? homeScore : awayScore;

  const fcsRecord = fcsIsAway ? game.awayRecord : game.homeRecord;
  const fbsRecord = fcsIsAway ? game.homeRecord : game.awayRecord;

  const alertLabel = computeUpsetAlert(fcsScore, fbsScore, status);
  if (!alertLabel) return null;

  const fcsAbbreviation = fcsIsAway ? game.awayAbbreviation : game.homeAbbreviation;
  const fbsAbbreviation = fcsIsAway ? game.homeAbbreviation : game.awayAbbreviation;
  const fcsShortDisplayName = fcsIsAway ? game.awayShortDisplayName : game.homeShortDisplayName;
  const fbsShortDisplayName = fcsIsAway ? game.homeShortDisplayName : game.awayShortDisplayName;

  return {
    id: game.id,
    fcsTeam: {
      id: fcsTeamId ?? `${game.id}-fcs`,
      name: getCompactTeamDisplayName({
        shortDisplayName: fcsShortDisplayName,
        abbreviation: fcsAbbreviation,
        displayName: fcsFullName,
      }),
      fullName: fcsFullName,
      abbreviation: fcsAbbreviation ?? abbreviateTeamName(fcsFullName),
      logoUrl: fcsIsAway ? game.awayLogoUrl : game.homeLogoUrl,
      division: 'fcs',
      record: fcsRecord,
    },
    fbsTeam: {
      id: fbsTeamId ?? `${game.id}-fbs`,
      name: getCompactTeamDisplayName({
        shortDisplayName: fbsShortDisplayName,
        abbreviation: fbsAbbreviation,
        displayName: fbsFullName,
      }),
      fullName: fbsFullName,
      abbreviation: fbsAbbreviation ?? abbreviateTeamName(fbsFullName),
      logoUrl: fcsIsAway ? game.homeLogoUrl : game.awayLogoUrl,
      division: 'fbs',
      record: fbsRecord,
    },
    fcsScore,
    fbsScore,
    status,
    statusDetail: status === 'live' ? game.status : game.status,
    alertLabel,
    broadcast: game.broadcast ?? '—',
    fcsRecord,
    fbsRecord,
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
