import { conferenceTextMatchesPattern } from '@/data/providers/espnConferenceLookup';
import { sortEspnNormalizedGames } from '@/utils/sortGames';
import type { EspnNormalizedGame } from '@/types';

export type ScoresFilterId =
  | 'top-25'
  | 'fcs-vs-fbs'
  | 'all-fcs'
  | 'big-sky'
  | 'mvfc'
  | 'caa'
  | 'southern'
  | 'united-athletic'
  | 'southland'
  | 'patriot'
  | 'ivy'
  | 'nec'
  | 'pioneer'
  | 'big-south-ovc'
  | 'swac'
  | 'meac'
  | 'fbs-top-25'
  | 'all-fbs'
  | 'fbs-sec'
  | 'fbs-big-ten'
  | 'fbs-big-12'
  | 'fbs-acc'
  | 'fbs-pac-12'
  | 'fbs-american'
  | 'fbs-mountain-west'
  | 'fbs-sun-belt'
  | 'fbs-cusa'
  | 'fbs-mac'
  | 'fbs-independents';

export type ScoresFilterSupport = 'full' | 'limited' | 'placeholder';

export type ScoresFilterOption = {
  id: ScoresFilterId;
  label: string;
  description: string;
  support: ScoresFilterSupport;
};

export type ScoresFilterMenuSection = {
  type: 'section';
  label: string;
  options: ScoresFilterOption[];
};

export type ScoresFilterMenuEntry =
  | { type: 'option'; option: ScoresFilterOption }
  | ScoresFilterMenuSection;

const TOP_25_OPTION: ScoresFilterOption = {
  id: 'top-25',
  label: 'Top 25',
  description: 'Games with at least one Stats Perform FCS Top 25 team',
  support: 'full',
};

const FCS_VS_FBS_OPTION: ScoresFilterOption = {
  id: 'fcs-vs-fbs',
  label: 'FCS vs FBS',
  description: 'Cross-division matchups between FCS and FBS teams',
  support: 'full',
};

const FCS_OPTIONS: ScoresFilterOption[] = [
  {
    id: 'all-fcs',
    label: 'All FCS',
    description: 'Every game on the ESPN FCS scoreboard feed',
    support: 'full',
  },
  { id: 'big-sky', label: 'Big Sky', description: 'Big Sky Conference teams', support: 'full' },
  {
    id: 'mvfc',
    label: 'MVFC',
    description: 'Missouri Valley Football Conference teams',
    support: 'full',
  },
  { id: 'caa', label: 'CAA', description: 'Coastal Athletic Association teams', support: 'full' },
  { id: 'southern', label: 'Southern', description: 'Southern Conference teams', support: 'full' },
  {
    id: 'united-athletic',
    label: 'United Athletic',
    description: 'United Athletic Conference teams',
    support: 'full',
  },
  { id: 'southland', label: 'Southland', description: 'Southland Conference teams', support: 'full' },
  { id: 'patriot', label: 'Patriot', description: 'Patriot League teams', support: 'full' },
  { id: 'ivy', label: 'Ivy League', description: 'Ivy League teams', support: 'full' },
  { id: 'nec', label: 'NEC', description: 'Northeast Conference teams', support: 'full' },
  { id: 'pioneer', label: 'Pioneer', description: 'Pioneer Football League teams', support: 'full' },
  {
    id: 'big-south-ovc',
    label: 'Big South OVC',
    description: 'Big South-OVC Football Association teams',
    support: 'full',
  },
  { id: 'swac', label: 'SWAC', description: 'Southwestern Athletic Conference teams', support: 'full' },
  { id: 'meac', label: 'MEAC', description: 'Mid-Eastern Athletic Conference teams', support: 'full' },
];

const FBS_OPTIONS: ScoresFilterOption[] = [
  {
    id: 'fbs-top-25',
    label: 'Top 25',
    description: 'FBS Top 25 games — requires FBS poll data not yet available',
    support: 'placeholder',
  },
  {
    id: 'all-fbs',
    label: 'All FBS',
    description: 'Games involving an FBS team on the FCS scoreboard feed',
    support: 'limited',
  },
  { id: 'fbs-sec', label: 'SEC', description: 'Southeastern Conference FBS teams', support: 'limited' },
  {
    id: 'fbs-big-ten',
    label: 'Big Ten',
    description: 'Big Ten Conference FBS teams',
    support: 'limited',
  },
  {
    id: 'fbs-big-12',
    label: 'Big 12',
    description: 'Big 12 Conference FBS teams',
    support: 'limited',
  },
  { id: 'fbs-acc', label: 'ACC', description: 'Atlantic Coast Conference FBS teams', support: 'limited' },
  {
    id: 'fbs-pac-12',
    label: 'Pac 12',
    description: 'Pac-12 Conference FBS teams',
    support: 'limited',
  },
  {
    id: 'fbs-american',
    label: 'American',
    description: 'American Athletic Conference FBS teams',
    support: 'limited',
  },
  {
    id: 'fbs-mountain-west',
    label: 'Mountain West',
    description: 'Mountain West Conference FBS teams',
    support: 'limited',
  },
  {
    id: 'fbs-sun-belt',
    label: 'Sun Belt',
    description: 'Sun Belt Conference FBS teams',
    support: 'limited',
  },
  {
    id: 'fbs-cusa',
    label: 'Conference USA',
    description: 'Conference USA FBS teams',
    support: 'limited',
  },
  { id: 'fbs-mac', label: 'MAC', description: 'Mid-American Conference FBS teams', support: 'limited' },
  {
    id: 'fbs-independents',
    label: 'Independents',
    description: 'FBS independent teams',
    support: 'limited',
  },
];

export const SCORES_FILTER_MENU: ScoresFilterMenuEntry[] = [
  { type: 'option', option: TOP_25_OPTION },
  { type: 'option', option: FCS_VS_FBS_OPTION },
  { type: 'section', label: 'FCS', options: FCS_OPTIONS },
  { type: 'section', label: 'FBS', options: FBS_OPTIONS },
];

export const DEFAULT_SCORES_FILTER: ScoresFilterId = 'top-25';

const ALL_FILTER_OPTIONS: ScoresFilterOption[] = [
  TOP_25_OPTION,
  FCS_VS_FBS_OPTION,
  ...FCS_OPTIONS,
  ...FBS_OPTIONS,
];

/** @deprecated Use SCORES_FILTER_MENU — kept for any legacy imports. */
export const SCORES_FILTER_OPTIONS = ALL_FILTER_OPTIONS;

/** Substrings matched against ESPN awayConference / homeConference (case-insensitive). */
const FCS_CONFERENCE_MATCH_PATTERNS: Partial<Record<ScoresFilterId, string[]>> = {
  'big-sky': ['big sky'],
  mvfc: ['mvfc', 'missouri valley'],
  caa: ['caa', 'colonial athletic', 'coastal athletic'],
  southern: ['southern conference', 'socon'],
  'united-athletic': ['united athletic', 'uac'],
  southland: ['southland'],
  patriot: ['patriot'],
  ivy: ['ivy'],
  nec: ['nec', 'northeast conference'],
  pioneer: ['pioneer'],
  'big-south-ovc': ['big south', 'ovc', 'ohio valley'],
  swac: ['swac', 'southwestern athletic'],
  meac: ['meac', 'mid-eastern'],
};

const FBS_CONFERENCE_MATCH_PATTERNS: Partial<Record<ScoresFilterId, string[]>> = {
  'fbs-sec': ['sec', 'southeastern conference'],
  'fbs-big-ten': ['big ten', 'big 10'],
  'fbs-big-12': ['big 12'],
  'fbs-acc': ['acc', 'atlantic coast'],
  'fbs-pac-12': ['pac-12', 'pac 12', 'pac-10'],
  'fbs-american': ['american athletic', 'aac'],
  'fbs-mountain-west': ['mountain west'],
  'fbs-sun-belt': ['sun belt'],
  'fbs-cusa': ['conference usa', 'c-usa', 'cusa'],
  'fbs-mac': ['mid-american', 'mid american'],
  'fbs-independents': ['fbs independent', 'independents', 'independent'],
};

export function getScoresFilterOption(filterId: ScoresFilterId): ScoresFilterOption | undefined {
  return ALL_FILTER_OPTIONS.find((option) => option.id === filterId);
}

export function getScoresFilterLabel(filterId: ScoresFilterId): string {
  return getScoresFilterOption(filterId)?.label ?? filterId;
}

export function getScoresFilterSupport(filterId: ScoresFilterId): ScoresFilterSupport {
  return getScoresFilterOption(filterId)?.support ?? 'full';
}

export function isFcsFbsEspnGame(game: EspnNormalizedGame): boolean {
  const awayFcs = game.awayDivision === 'fcs';
  const awayFbs = game.awayDivision === 'fbs';
  const homeFcs = game.homeDivision === 'fcs';
  const homeFbs = game.homeDivision === 'fbs';
  return (awayFcs && homeFbs) || (awayFbs && homeFcs);
}

function isFcsFbsMatchup(game: EspnNormalizedGame): boolean {
  return isFcsFbsEspnGame(game);
}

function hasFbsTeam(game: EspnNormalizedGame): boolean {
  return game.awayDivision === 'fbs' || game.homeDivision === 'fbs';
}

function matchesConferenceFields(fields: string[], patterns: string[]): boolean {
  for (const field of fields) {
    if (patterns.some((pattern) => conferenceTextMatchesPattern(field, pattern))) {
      return true;
    }
  }
  return false;
}

function getGameConferenceFields(game: EspnNormalizedGame): string[] {
  return [game.awayConference, game.homeConference, game.groupInfo].filter(
    (value): value is string => Boolean(value),
  );
}

function matchesFcsConference(game: EspnNormalizedGame, patterns: string[]): boolean {
  return matchesConferenceFields(getGameConferenceFields(game), patterns);
}

function matchesFbsConference(game: EspnNormalizedGame, patterns: string[]): boolean {
  const fields: string[] = [];

  if (game.awayDivision === 'fbs' && game.awayConference) {
    fields.push(game.awayConference);
  }
  if (game.homeDivision === 'fbs' && game.homeConference) {
    fields.push(game.homeConference);
  }

  return matchesConferenceFields(fields, patterns);
}

export type ScoresFilterDiagnostics = {
  totalGamesLoaded: number;
  selectedFilter: ScoresFilterId;
  selectedFilterLabel: string;
  gamesAfterFilter: number;
  uniqueConferences: string[];
  divisionValues: string[];
  rankedGamesCount: number;
  fcsVsFbsGamesCount: number;
  gamesWithConferenceData: number;
  gamesWithDivisionData: number;
};

export function collectScoresFilterDiagnostics(
  games: EspnNormalizedGame[],
  filterId: ScoresFilterId,
): ScoresFilterDiagnostics {
  const conferences = new Set<string>();
  const divisions = new Set<string>();

  for (const game of games) {
    if (game.awayConference) conferences.add(game.awayConference);
    if (game.homeConference) conferences.add(game.homeConference);
    if (game.awayDivision) divisions.add(game.awayDivision);
    if (game.homeDivision) divisions.add(game.homeDivision);
  }

  const filteredGames = applyScoresFilter(games, filterId);

  return {
    totalGamesLoaded: games.length,
    selectedFilter: filterId,
    selectedFilterLabel: getScoresFilterLabel(filterId),
    gamesAfterFilter: filteredGames.length,
    uniqueConferences: [...conferences].sort(),
    divisionValues: [...divisions].sort(),
    rankedGamesCount: games.filter((game) => game.awayIsRanked || game.homeIsRanked).length,
    fcsVsFbsGamesCount: games.filter(isFcsFbsEspnGame).length,
    gamesWithConferenceData: games.filter(
      (game) => Boolean(game.awayConference || game.homeConference),
    ).length,
    gamesWithDivisionData: games.filter(
      (game) =>
        (game.awayDivision && game.awayDivision !== 'unknown') ||
        (game.homeDivision && game.homeDivision !== 'unknown'),
    ).length,
  };
}

export function applyScoresFilter(
  games: EspnNormalizedGame[],
  filterId: ScoresFilterId,
): EspnNormalizedGame[] {
  const support = getScoresFilterSupport(filterId);
  if (support === 'placeholder') {
    return [];
  }

  switch (filterId) {
    case 'top-25':
      return games.filter((game) => game.awayIsRanked || game.homeIsRanked);
    case 'fcs-vs-fbs':
      return games.filter(isFcsFbsMatchup);
    case 'all-fcs':
      return games;
    case 'all-fbs':
      return games.filter(hasFbsTeam);
    default: {
      const fcsPatterns = FCS_CONFERENCE_MATCH_PATTERNS[filterId];
      if (fcsPatterns) {
        return games.filter((game) => matchesFcsConference(game, fcsPatterns));
      }

      const fbsPatterns = FBS_CONFERENCE_MATCH_PATTERNS[filterId];
      if (fbsPatterns) {
        return games.filter((game) => matchesFbsConference(game, fbsPatterns));
      }

      return games;
    }
  }
}

export type ScoresStatusGroup = {
  key: 'live' | 'upcoming' | 'final';
  title: string;
  games: EspnNormalizedGame[];
};

export function groupScoresByStatus(games: EspnNormalizedGame[]): ScoresStatusGroup[] {
  const live: EspnNormalizedGame[] = [];
  const upcoming: EspnNormalizedGame[] = [];
  const finalGames: EspnNormalizedGame[] = [];

  for (const game of games) {
    switch (game.normalizedStatus) {
      case 'in_progress':
        live.push(game);
        break;
      case 'final':
        finalGames.push(game);
        break;
      default:
        upcoming.push(game);
    }
  }

  const groups: ScoresStatusGroup[] = [
    { key: 'live', title: 'Live', games: sortEspnNormalizedGames(live) },
    { key: 'upcoming', title: 'Upcoming', games: sortEspnNormalizedGames(upcoming) },
    { key: 'final', title: 'Final', games: sortEspnNormalizedGames(finalGames) },
  ];

  return groups.filter((group) => group.games.length > 0);
}
