import {
  DROPDOWN_OPTION_ROW_HEIGHT,
  DROPDOWN_SECTION_HEADER_HEIGHT,
} from '@/components/dropdownStyles';
import type { ConferenceId } from '@/data/conferences/conferenceList';
import {
  getFbsConferenceOptions,
  getFcsConferenceOptions,
} from '@/data/conferences/conferenceList';
import {
  conferenceRecordMatchesPatterns,
  lookupEspnConference,
  normalizeConferenceText,
} from '@/data/providers/espnConferenceLookup';
import { isEspnFbsTop25Rank } from '@/data/providers/espnFbsRankings';
import type { ScoresLeagueFilterId } from '@/data/providers/types';
import { sortEspnNormalizedGames } from '@/utils/sortGames';
import type { EspnNormalizedGame } from '@/types';

export type ScoresFilterId =
  | 'fcs-top-25'
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

const FCS_VS_FBS_OPTION: ScoresFilterOption = {
  id: 'fcs-vs-fbs',
  label: 'FCS vs FBS',
  description: 'Cross-division matchups between FCS and FBS teams',
  support: 'full',
};

const ALL_FCS_OPTION: ScoresFilterOption = {
  id: 'all-fcs',
  label: 'All FCS',
  description: 'Every game on the ESPN FCS scoreboard feed',
  support: 'full',
};

const FCS_TOP_25_OPTION: ScoresFilterOption = {
  id: 'fcs-top-25',
  label: 'FCS Top 25',
  description: 'FCS games with at least one Stats Perform Top 25 team',
  support: 'full',
};

const ALL_FBS_OPTION: ScoresFilterOption = {
  id: 'all-fbs',
  label: 'All FBS',
  description: 'Every game on the ESPN FBS scoreboard feed',
  support: 'full',
};

const FBS_TOP_25_OPTION: ScoresFilterOption = {
  id: 'fbs-top-25',
  label: 'FBS Top 25',
  description: 'FBS games with at least one ESPN curated Top 25 team',
  support: 'full',
};

const FCS_CONFERENCE_TO_SCORES_FILTER: Partial<Record<ConferenceId, ScoresFilterId>> = {
  'ivy-league': 'ivy',
};

const FBS_CONFERENCE_TO_SCORES_FILTER: Partial<Record<ConferenceId, ScoresFilterId>> = {
  'conference-usa': 'fbs-cusa',
  independents: 'fbs-independents',
  mac: 'fbs-mac',
  sec: 'fbs-sec',
  'big-ten': 'fbs-big-ten',
  'big-12': 'fbs-big-12',
  acc: 'fbs-acc',
  'pac-12': 'fbs-pac-12',
  american: 'fbs-american',
  'mountain-west': 'fbs-mountain-west',
  'sun-belt': 'fbs-sun-belt',
};

function toFcsScoresFilterId(conferenceId: ConferenceId): ScoresFilterId {
  return (FCS_CONFERENCE_TO_SCORES_FILTER[conferenceId] ?? conferenceId) as ScoresFilterId;
}

function toFbsScoresFilterId(conferenceId: ConferenceId): ScoresFilterId {
  return (FBS_CONFERENCE_TO_SCORES_FILTER[conferenceId] ??
    `fbs-${conferenceId}`) as ScoresFilterId;
}

const FCS_CONFERENCE_OPTIONS: ScoresFilterOption[] = getFcsConferenceOptions()
  .filter((option) => option.id !== 'fcs-independents')
  .map((option) => ({
    id: toFcsScoresFilterId(option.id),
    label: option.label,
    description: `${option.label} teams`,
    support: 'full' as ScoresFilterSupport,
  }));

const FBS_CONFERENCE_OPTIONS: ScoresFilterOption[] = getFbsConferenceOptions().map((option) => ({
  id: toFbsScoresFilterId(option.id),
  label: option.label,
  description: `${option.label} teams`,
  support: 'full' as ScoresFilterSupport,
}));

const FCS_OPTIONS: ScoresFilterOption[] = [
  ALL_FCS_OPTION,
  FCS_TOP_25_OPTION,
  ...FCS_CONFERENCE_OPTIONS,
];

const FBS_OPTIONS: ScoresFilterOption[] = [
  ALL_FBS_OPTION,
  FBS_TOP_25_OPTION,
  ...FBS_CONFERENCE_OPTIONS,
];

export const SCORES_FILTER_MENU: ScoresFilterMenuEntry[] = [
  { type: 'option', option: FCS_VS_FBS_OPTION },
  { type: 'section', label: 'FCS', options: FCS_OPTIONS },
  { type: 'section', label: 'FBS', options: FBS_OPTIONS },
];

export type FlatScoresFilterItem =
  | { type: 'section-header'; key: string; label: string }
  | { type: 'option'; key: string; option: ScoresFilterOption };

/** Flatten sectioned menu for scroll-to-selected positioning. */
export function flattenScoresFilterMenu(menu: ScoresFilterMenuEntry[]): FlatScoresFilterItem[] {
  const items: FlatScoresFilterItem[] = [];

  for (const entry of menu) {
    if (entry.type === 'option') {
      items.push({ type: 'option', key: entry.option.id, option: entry.option });
      continue;
    }

    items.push({ type: 'section-header', key: `section-${entry.label}`, label: entry.label });
    for (const option of entry.options) {
      items.push({ type: 'option', key: option.id, option });
    }
  }

  return items;
}

export const FLAT_SCORES_FILTER_MENU = flattenScoresFilterMenu(SCORES_FILTER_MENU);

export function findScoresFilterMenuIndex(
  menu: FlatScoresFilterItem[],
  selected: ScoresFilterId,
): number {
  return menu.findIndex((item) => item.type === 'option' && item.option.id === selected);
}

export function getScoresFilterMenuItemHeight(item: FlatScoresFilterItem): number {
  return item.type === 'section-header'
    ? DROPDOWN_SECTION_HEADER_HEIGHT
    : DROPDOWN_OPTION_ROW_HEIGHT;
}

export const DEFAULT_SCORES_FILTER: ScoresFilterId = 'fcs-top-25';

const ALL_FILTER_OPTIONS: ScoresFilterOption[] = [
  FCS_VS_FBS_OPTION,
  ...FCS_OPTIONS,
  ...FBS_OPTIONS,
];

/** @deprecated Use SCORES_FILTER_MENU — kept for any legacy imports. */
export const SCORES_FILTER_OPTIONS = ALL_FILTER_OPTIONS;

/** ESPN fetch scope implied by the selected Scores filter. */
export function resolveScoresLeagueFromFilter(filterId: ScoresFilterId): ScoresLeagueFilterId {
  if (filterId === 'fcs-vs-fbs') return 'all';
  if (filterId === 'all-fbs' || filterId.startsWith('fbs-')) return 'fbs';
  return 'fcs';
}

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

export type ScoresFilterApplyOptions = {
  /** ESPN fetch scope for the loaded game set — relaxes FBS detection on FBS-only feeds. */
  league?: ScoresLeagueFilterId;
};

function isFbsFilterId(filterId: ScoresFilterId): boolean {
  return filterId === 'all-fbs' || filterId === 'fbs-top-25' || filterId.startsWith('fbs-');
}

function isFbsOnlyFeed(league: ScoresLeagueFilterId | undefined, filterId: ScoresFilterId): boolean {
  return league === 'fbs' || (league === undefined && isFbsFilterId(filterId));
}

function isExplicitFcsTeam(division: EspnNormalizedGame['awayDivision']): boolean {
  return division === 'fcs';
}

function isExplicitFbsTeam(division: EspnNormalizedGame['awayDivision']): boolean {
  return division === 'fbs';
}

function isFbsEligibleTeam(
  game: EspnNormalizedGame,
  side: 'away' | 'home',
  league?: ScoresLeagueFilterId,
): boolean {
  const division = side === 'away' ? game.awayDivision : game.homeDivision;
  if (isExplicitFcsTeam(division)) return false;
  if (isExplicitFbsTeam(division)) return true;
  return league === 'fbs';
}

function hasFbsTeam(game: EspnNormalizedGame, league?: ScoresLeagueFilterId): boolean {
  return isFbsEligibleTeam(game, 'away', league) || isFbsEligibleTeam(game, 'home', league);
}

function hasFcsTeam(game: EspnNormalizedGame): boolean {
  return game.awayDivision === 'fcs' || game.homeDivision === 'fcs';
}

function gameHasFbsTop25Team(
  game: EspnNormalizedGame,
  league?: ScoresLeagueFilterId,
): boolean {
  if (isEspnFbsTop25Rank(game.awayRank) && isFbsEligibleTeam(game, 'away', league)) {
    return true;
  }
  if (isEspnFbsTop25Rank(game.homeRank) && isFbsEligibleTeam(game, 'home', league)) {
    return true;
  }
  return false;
}

function isFcsRankedSide(game: EspnNormalizedGame, side: 'away' | 'home'): boolean {
  const division = side === 'away' ? game.awayDivision : game.homeDivision;
  const isRanked = side === 'away' ? game.awayIsRanked : game.homeIsRanked;
  return division !== 'fbs' && Boolean(isRanked);
}

function collectConferenceMatchFields(value: string | undefined): string[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  const fields = [trimmed];
  if (/^\d+$/.test(trimmed)) {
    const record = lookupEspnConference(trimmed);
    if (record) {
      fields.push(record.name, ...record.aliases);
    }
  }

  return fields;
}

function getFbsTeamConferenceFields(
  game: EspnNormalizedGame,
  side: 'away' | 'home',
  league?: ScoresLeagueFilterId,
): string[] {
  if (!isFbsEligibleTeam(game, side, league)) {
    return [];
  }

  const conference = side === 'away' ? game.awayConference : game.homeConference;
  return collectConferenceMatchFields(conference);
}

function conferenceFieldMatchesPatterns(field: string, patterns: string[]): boolean {
  const normalizedField = normalizeConferenceText(field);
  if (!normalizedField) return false;

  return patterns.some((pattern) => {
    const normalizedPattern = normalizeConferenceText(pattern);
    if (!normalizedPattern) return false;
    return normalizedField.includes(normalizedPattern);
  });
}

function matchesConferenceFields(fields: string[], patterns: string[]): boolean {
  for (const field of fields) {
    if (conferenceFieldMatchesPatterns(field, patterns)) {
      return true;
    }

    if (/^\d+$/.test(field.trim())) {
      const record = lookupEspnConference(field.trim());
      if (conferenceRecordMatchesPatterns(record, patterns)) {
        return true;
      }
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

function matchesFbsConference(
  game: EspnNormalizedGame,
  patterns: string[],
  league?: ScoresLeagueFilterId,
): boolean {
  const fields = [
    ...getFbsTeamConferenceFields(game, 'away', league),
    ...getFbsTeamConferenceFields(game, 'home', league),
  ];

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
  options?: ScoresFilterApplyOptions,
): EspnNormalizedGame[] {
  const support = getScoresFilterSupport(filterId);
  if (support === 'placeholder') {
    return [];
  }

  const league = options?.league;

  switch (filterId) {
    case 'fcs-top-25':
      return games.filter(
        (game) => isFcsRankedSide(game, 'away') || isFcsRankedSide(game, 'home'),
      );
    case 'fbs-top-25':
      return games.filter((game) => gameHasFbsTop25Team(game, league));
    case 'fcs-vs-fbs':
      return games.filter(isFcsFbsMatchup);
    case 'all-fcs':
      return games.filter(
        (game) =>
          hasFcsTeam(game) ||
          (game.awayDivision !== 'fbs' && game.homeDivision !== 'fbs'),
      );
    case 'all-fbs':
      if (isFbsOnlyFeed(league, filterId)) {
        return games;
      }
      return games.filter((game) => hasFbsTeam(game, league));
    default: {
      const fcsPatterns = FCS_CONFERENCE_MATCH_PATTERNS[filterId];
      if (fcsPatterns) {
        return games.filter((game) => matchesFcsConference(game, fcsPatterns));
      }

      const fbsPatterns = FBS_CONFERENCE_MATCH_PATTERNS[filterId];
      if (fbsPatterns) {
        return games.filter((game) => matchesFbsConference(game, fbsPatterns, league));
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
