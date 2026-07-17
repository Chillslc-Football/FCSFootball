import {
  DROPDOWN_OPTION_ROW_HEIGHT,
  DROPDOWN_SECTION_HEADER_HEIGHT,
} from '@/components/dropdownStyles';
import { normalizeConferenceText } from '@/data/providers/espnConferenceLookup';

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
  | 'fcs-independents'
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

export type ConferenceDivision = 'fbs' | 'fcs';

export type ConferenceSubdivision = 'FBS' | 'FCS' | 'OTHER';

export type ConferenceMetadata = {
  id: ConferenceId;
  displayName: string;
  division: ConferenceDivision;
  /** ESPN standings/scoreboard group id when known */
  espnGroupId?: string;
  aliases?: string[];
};

export type ConferenceOption = {
  id: ConferenceId;
  label: string;
  division: ConferenceDivision;
};

export type ConferenceMenuEntry =
  | { type: 'header'; label: string }
  | { type: 'option'; option: ConferenceOption };

export const DEFAULT_CONFERENCE_ID: ConferenceId = 'big-sky';

const CONFERENCE_METADATA: ConferenceMetadata[] = [
  {
    id: 'acc',
    displayName: 'ACC',
    division: 'fbs',
    espnGroupId: '1',
    aliases: ['atlantic coast conference', 'atlantic coast'],
  },
  {
    id: 'american',
    displayName: 'American Athletic Conference',
    division: 'fbs',
    espnGroupId: '151',
    aliases: ['american athletic', 'aac', 'american conference'],
  },
  {
    id: 'big-ten',
    displayName: 'Big Ten',
    division: 'fbs',
    espnGroupId: '5',
    aliases: ['big ten conference', 'big 10'],
  },
  {
    id: 'big-12',
    displayName: 'Big 12',
    division: 'fbs',
    espnGroupId: '4',
    aliases: ['big 12 conference', 'big twelve'],
  },
  {
    id: 'conference-usa',
    displayName: 'Conference USA',
    division: 'fbs',
    espnGroupId: '12',
    aliases: ['c-usa', 'cusa'],
  },
  {
    id: 'independents',
    displayName: 'FBS Independents',
    division: 'fbs',
    espnGroupId: '18',
    aliases: ['fbs independent', 'fbs independents', 'independents', 'independent'],
  },
  {
    id: 'mac',
    displayName: 'Mid-American Conference',
    division: 'fbs',
    espnGroupId: '15',
    aliases: ['mac', 'mid american', 'mid-american'],
  },
  {
    id: 'mountain-west',
    displayName: 'Mountain West',
    division: 'fbs',
    espnGroupId: '17',
    aliases: ['mountain west conference', 'mwc'],
  },
  {
    id: 'pac-12',
    displayName: 'Pac-12',
    division: 'fbs',
    espnGroupId: '9',
    aliases: ['pac 12', 'pac twelve', 'pac-12 conference'],
  },
  {
    id: 'sec',
    displayName: 'SEC',
    division: 'fbs',
    espnGroupId: '8',
    aliases: ['southeastern conference', 'southeastern'],
  },
  {
    id: 'sun-belt',
    displayName: 'Sun Belt',
    division: 'fbs',
    espnGroupId: '37',
    aliases: ['sun belt conference'],
  },
  {
    id: 'big-sky',
    displayName: 'Big Sky',
    division: 'fcs',
    espnGroupId: '20',
    aliases: ['big sky conference'],
  },
  {
    id: 'big-south-ovc',
    displayName: 'Big South-OVC',
    division: 'fcs',
    espnGroupId: '179',
    aliases: ['big south ovc', 'ovc big south', 'ohio valley', 'big south'],
  },
  {
    id: 'caa',
    displayName: 'CAA',
    division: 'fcs',
    espnGroupId: '48',
    aliases: ['coastal athletic association', 'colonial athletic', 'coastal athletic'],
  },
  {
    id: 'fcs-independents',
    displayName: 'FCS Independents',
    division: 'fcs',
    espnGroupId: '32',
    aliases: ['fcs independent', 'fcs independents'],
  },
  {
    id: 'ivy-league',
    displayName: 'Ivy League',
    division: 'fcs',
    espnGroupId: '22',
    aliases: ['ivy'],
  },
  {
    id: 'meac',
    displayName: 'MEAC',
    division: 'fcs',
    espnGroupId: '24',
    aliases: ['mid-eastern athletic conference', 'mid eastern'],
  },
  {
    id: 'mvfc',
    displayName: 'Missouri Valley Football Conference',
    division: 'fcs',
    espnGroupId: '21',
    aliases: ['mvfc', 'missouri valley'],
  },
  {
    id: 'nec',
    displayName: 'NEC',
    division: 'fcs',
    espnGroupId: '25',
    aliases: ['northeast conference'],
  },
  {
    id: 'patriot',
    displayName: 'Patriot League',
    division: 'fcs',
    espnGroupId: '27',
    aliases: ['patriot'],
  },
  {
    id: 'pioneer',
    displayName: 'Pioneer Football League',
    division: 'fcs',
    espnGroupId: '28',
    aliases: ['pioneer'],
  },
  {
    id: 'southern',
    displayName: 'SoCon',
    division: 'fcs',
    espnGroupId: '29',
    aliases: ['southern conference', 'socon'],
  },
  {
    id: 'southland',
    displayName: 'Southland',
    division: 'fcs',
    espnGroupId: '30',
    aliases: ['southland conference'],
  },
  {
    id: 'swac',
    displayName: 'SWAC',
    division: 'fcs',
    espnGroupId: '31',
    aliases: ['southwestern athletic conference', 'southwestern athletic'],
  },
  {
    id: 'united-athletic',
    displayName: 'United Athletic Conference',
    division: 'fcs',
    espnGroupId: '177',
    aliases: ['united athletic', 'uac'],
  },
];

const METADATA_BY_ID = new Map(CONFERENCE_METADATA.map((entry) => [entry.id, entry]));

/** Runtime unrecognized ESPN conferences — surfaced under the Other menu section when provided. */
const unrecognizedConferenceOptions: ConferenceOption[] = [];

function compareConferenceDisplayName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function toConferenceOption(metadata: ConferenceMetadata): ConferenceOption {
  return {
    id: metadata.id,
    label: metadata.displayName,
    division: metadata.division,
  };
}

function sortConferenceOptions(options: ConferenceOption[]): ConferenceOption[] {
  return [...options].sort((a, b) => compareConferenceDisplayName(a.label, b.label));
}

export function getConferenceMetadata(id: ConferenceId): ConferenceMetadata | undefined {
  return METADATA_BY_ID.get(id);
}

export const CONFERENCE_OPTIONS: ConferenceOption[] = CONFERENCE_METADATA.map(toConferenceOption);

export function getFbsConferenceOptions(): ConferenceOption[] {
  return sortConferenceOptions(
    CONFERENCE_METADATA.filter((entry) => entry.division === 'fbs').map(toConferenceOption),
  );
}

export function getFcsConferenceOptions(): ConferenceOption[] {
  return sortConferenceOptions(
    CONFERENCE_METADATA.filter((entry) => entry.division === 'fcs').map(toConferenceOption),
  );
}

export function buildConferenceMenu(
  extraOtherOptions: ConferenceOption[] = unrecognizedConferenceOptions,
): ConferenceMenuEntry[] {
  const menu: ConferenceMenuEntry[] = [
    { type: 'header', label: 'FBS' },
    ...getFbsConferenceOptions().map((option) => ({ type: 'option' as const, option })),
    { type: 'header', label: 'FCS' },
    ...getFcsConferenceOptions().map((option) => ({ type: 'option' as const, option })),
  ];

  const otherOptions = sortConferenceOptions(extraOtherOptions);
  if (otherOptions.length > 0) {
    menu.push({ type: 'header', label: 'Other' });
    menu.push(...otherOptions.map((option) => ({ type: 'option' as const, option })));
  }

  return menu;
}

/** Conferences tab dropdown — FCS section before FBS. */
export function buildConferencesTabMenu(
  extraOtherOptions: ConferenceOption[] = unrecognizedConferenceOptions,
): ConferenceMenuEntry[] {
  const menu: ConferenceMenuEntry[] = [
    { type: 'header', label: 'FCS' },
    ...getFcsConferenceOptions().map((option) => ({ type: 'option' as const, option })),
    { type: 'header', label: 'FBS' },
    ...getFbsConferenceOptions().map((option) => ({ type: 'option' as const, option })),
  ];

  const otherOptions = sortConferenceOptions(extraOtherOptions);
  if (otherOptions.length > 0) {
    menu.push({ type: 'header', label: 'Other' });
    menu.push(...otherOptions.map((option) => ({ type: 'option' as const, option })));
  }

  return menu;
}

export const CONFERENCE_MENU: ConferenceMenuEntry[] = buildConferenceMenu();

export const CONFERENCES_TAB_MENU: ConferenceMenuEntry[] = buildConferencesTabMenu();

export type FlatConferenceMenuItem =
  | { type: 'section-header'; key: string; label: string }
  | { type: 'option'; key: string; option: ConferenceOption };

export function flattenConferenceMenu(
  menu: ConferenceMenuEntry[] = CONFERENCE_MENU,
): FlatConferenceMenuItem[] {
  const items: FlatConferenceMenuItem[] = [];

  for (const entry of menu) {
    if (entry.type === 'header') {
      items.push({ type: 'section-header', key: `header-${entry.label}`, label: entry.label });
      continue;
    }

    items.push({ type: 'option', key: entry.option.id, option: entry.option });
  }

  return items;
}

export function findConferenceMenuIndex(
  selected: ConferenceId,
  menu: ConferenceMenuEntry[] = CONFERENCE_MENU,
): number {
  const flat = flattenConferenceMenu(menu);
  return flat.findIndex((item) => item.type === 'option' && item.option.id === selected);
}

export function getConferenceMenuItemHeight(item: FlatConferenceMenuItem): number {
  return item.type === 'section-header'
    ? DROPDOWN_SECTION_HEADER_HEIGHT
    : DROPDOWN_OPTION_ROW_HEIGHT;
}

const CONFERENCE_BY_ID = new Map(CONFERENCE_OPTIONS.map((option) => [option.id, option]));

export function getConferenceLabel(id: ConferenceId): string {
  return CONFERENCE_BY_ID.get(id)?.label ?? id;
}

export function getConferenceEspnGroupId(id: ConferenceId): string | undefined {
  return METADATA_BY_ID.get(id)?.espnGroupId;
}

export function getAllConferenceMetadata(): readonly ConferenceMetadata[] {
  return CONFERENCE_METADATA;
}

/** Match ESPN or display text to a canonical conference id using display names and aliases. */
export function matchConferenceIdFromDisplayText(text: string): ConferenceId | undefined {
  const normalized = normalizeConferenceText(text);
  if (!normalized) return undefined;

  for (const entry of CONFERENCE_METADATA) {
    const fields = [entry.displayName, ...(entry.aliases ?? [])];
    for (const field of fields) {
      const fieldNorm = normalizeConferenceText(field);
      if (!fieldNorm) continue;
      if (normalized === fieldNorm) return entry.id;
      if (normalized.includes(fieldNorm) || fieldNorm.includes(normalized)) return entry.id;
    }
  }

  return undefined;
}
