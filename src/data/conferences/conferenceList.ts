export type ConferenceId =
  | 'big-sky'
  | 'mvfc'
  | 'caa'
  | 'southern'
  | 'united-athletic'
  | 'southland'
  | 'patriot'
  | 'ivy-league'
  | 'nec'
  | 'pioneer'
  | 'big-south-ovc'
  | 'swac'
  | 'meac'
  | 'sec'
  | 'big-ten'
  | 'big-12'
  | 'acc'
  | 'pac-12'
  | 'american'
  | 'mountain-west'
  | 'sun-belt'
  | 'conference-usa'
  | 'mac'
  | 'independents';

export type ConferenceDivision = 'fcs' | 'fbs';

export type ConferenceOption = {
  id: ConferenceId;
  label: string;
  division: ConferenceDivision;
};

export type ConferenceMenuEntry =
  | { type: 'header'; label: string }
  | { type: 'option'; option: ConferenceOption };

export const DEFAULT_CONFERENCE_ID: ConferenceId = 'big-sky';

const FCS_CONFERENCES: ConferenceOption[] = [
  { id: 'big-sky', label: 'Big Sky', division: 'fcs' },
  { id: 'mvfc', label: 'MVFC', division: 'fcs' },
  { id: 'caa', label: 'CAA', division: 'fcs' },
  { id: 'southern', label: 'Southern', division: 'fcs' },
  { id: 'united-athletic', label: 'United Athletic', division: 'fcs' },
  { id: 'southland', label: 'Southland', division: 'fcs' },
  { id: 'patriot', label: 'Patriot', division: 'fcs' },
  { id: 'ivy-league', label: 'Ivy League', division: 'fcs' },
  { id: 'nec', label: 'NEC', division: 'fcs' },
  { id: 'pioneer', label: 'Pioneer', division: 'fcs' },
  { id: 'big-south-ovc', label: 'Big South OVC', division: 'fcs' },
  { id: 'swac', label: 'SWAC', division: 'fcs' },
  { id: 'meac', label: 'MEAC', division: 'fcs' },
];

const FBS_CONFERENCES: ConferenceOption[] = [
  { id: 'sec', label: 'SEC', division: 'fbs' },
  { id: 'big-ten', label: 'Big Ten', division: 'fbs' },
  { id: 'big-12', label: 'Big 12', division: 'fbs' },
  { id: 'acc', label: 'ACC', division: 'fbs' },
  { id: 'pac-12', label: 'Pac 12', division: 'fbs' },
  { id: 'american', label: 'American', division: 'fbs' },
  { id: 'mountain-west', label: 'Mountain West', division: 'fbs' },
  { id: 'sun-belt', label: 'Sun Belt', division: 'fbs' },
  { id: 'conference-usa', label: 'Conference USA', division: 'fbs' },
  { id: 'mac', label: 'MAC', division: 'fbs' },
  { id: 'independents', label: 'Independents', division: 'fbs' },
];

export const CONFERENCE_OPTIONS: ConferenceOption[] = [
  ...FCS_CONFERENCES,
  ...FBS_CONFERENCES,
];

export const CONFERENCE_MENU: ConferenceMenuEntry[] = [
  { type: 'header', label: 'FCS Conferences' },
  ...FCS_CONFERENCES.map((option) => ({ type: 'option' as const, option })),
  { type: 'header', label: 'FBS Conferences' },
  ...FBS_CONFERENCES.map((option) => ({ type: 'option' as const, option })),
];

const CONFERENCE_BY_ID = new Map(CONFERENCE_OPTIONS.map((option) => [option.id, option]));

export function getConferenceLabel(id: ConferenceId): string {
  return CONFERENCE_BY_ID.get(id)?.label ?? id;
}
