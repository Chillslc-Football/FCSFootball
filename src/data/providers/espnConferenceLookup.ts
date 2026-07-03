import type { EspnDivisionHint } from '@/types';

export type EspnConferenceRecord = {
  id: string;
  name: string;
  division: 'fcs' | 'fbs';
  /** Normalized aliases for filter matching */
  aliases: string[];
};

/** ESPN group IDs for FCS/FBS conferences — from ESPN core groups API. */
const ESPN_CONFERENCE_BY_ID: Record<string, EspnConferenceRecord> = {
  '1': {
    id: '1',
    name: 'Atlantic Coast Conference',
    division: 'fbs',
    aliases: ['acc', 'atlantic coast'],
  },
  '4': {
    id: '4',
    name: 'Big 12 Conference',
    division: 'fbs',
    aliases: ['big 12', 'big twelve'],
  },
  '5': {
    id: '5',
    name: 'Big Ten Conference',
    division: 'fbs',
    aliases: ['big ten', 'big 10'],
  },
  '8': {
    id: '8',
    name: 'Southeastern Conference',
    division: 'fbs',
    aliases: ['sec', 'southeastern'],
  },
  '9': {
    id: '9',
    name: 'Pac-12 Conference',
    division: 'fbs',
    aliases: ['pac 12', 'pac-12', 'pac twelve'],
  },
  '12': {
    id: '12',
    name: 'Conference USA',
    division: 'fbs',
    aliases: ['conference usa', 'c usa', 'cusa'],
  },
  '15': {
    id: '15',
    name: 'Mid-American Conference',
    division: 'fbs',
    aliases: ['mac', 'mid american', 'mid-american'],
  },
  '17': {
    id: '17',
    name: 'Mountain West Conference',
    division: 'fbs',
    aliases: ['mountain west', 'mwc'],
  },
  '18': {
    id: '18',
    name: 'FBS Independents',
    division: 'fbs',
    aliases: ['fbs independent', 'independent', 'independents'],
  },
  '37': {
    id: '37',
    name: 'Sun Belt Conference',
    division: 'fbs',
    aliases: ['sun belt'],
  },
  '151': {
    id: '151',
    name: 'American Conference',
    division: 'fbs',
    aliases: ['american athletic', 'aac', 'american conference'],
  },
  '20': {
    id: '20',
    name: 'Big Sky Conference',
    division: 'fcs',
    aliases: ['big sky'],
  },
  '21': {
    id: '21',
    name: 'Missouri Valley Football Conference',
    division: 'fcs',
    aliases: ['mvfc', 'missouri valley'],
  },
  '24': {
    id: '24',
    name: 'Mid-Eastern Athletic Conference',
    division: 'fcs',
    aliases: ['meac', 'mid eastern'],
  },
  '25': {
    id: '25',
    name: 'Northeast Conference',
    division: 'fcs',
    aliases: ['nec', 'northeast conference'],
  },
  '27': {
    id: '27',
    name: 'Patriot League',
    division: 'fcs',
    aliases: ['patriot'],
  },
  '28': {
    id: '28',
    name: 'Pioneer Football League',
    division: 'fcs',
    aliases: ['pioneer'],
  },
  '29': {
    id: '29',
    name: 'Southern Conference',
    division: 'fcs',
    aliases: ['southern conference', 'socon'],
  },
  '30': {
    id: '30',
    name: 'Southland Conference',
    division: 'fcs',
    aliases: ['southland'],
  },
  '31': {
    id: '31',
    name: 'Southwestern Athletic Conference',
    division: 'fcs',
    aliases: ['swac', 'southwestern athletic'],
  },
  '32': {
    id: '32',
    name: 'FCS Independents',
    division: 'fcs',
    aliases: ['fcs independent', 'independent'],
  },
  '48': {
    id: '48',
    name: 'Coastal Athletic Association',
    division: 'fcs',
    aliases: ['caa', 'coastal athletic', 'colonial athletic'],
  },
  '177': {
    id: '177',
    name: 'United Athletic Conference',
    division: 'fcs',
    aliases: ['united athletic', 'uac'],
  },
  '179': {
    id: '179',
    name: 'OVC-Big South Association',
    division: 'fcs',
    aliases: ['big south ovc', 'ovc big south', 'ohio valley', 'big south'],
  },
};

export function lookupEspnConference(conferenceId: string | undefined): EspnConferenceRecord | undefined {
  if (!conferenceId) return undefined;
  return ESPN_CONFERENCE_BY_ID[conferenceId];
}

export function resolveEspnConferenceName(conferenceId: string | undefined): string | undefined {
  return lookupEspnConference(conferenceId)?.name;
}

export function resolveEspnDivisionFromConferenceId(
  conferenceId: string | undefined,
): EspnDivisionHint | undefined {
  const record = lookupEspnConference(conferenceId);
  return record?.division;
}

/** Lowercase, strip punctuation, collapse whitespace — for tolerant filter matching. */
export function normalizeConferenceText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function conferenceTextMatchesPattern(field: string, pattern: string): boolean {
  const normalizedField = normalizeConferenceText(field);
  const normalizedPattern = normalizeConferenceText(pattern);
  if (!normalizedField || !normalizedPattern) return false;
  return normalizedField.includes(normalizedPattern);
}

export function conferenceRecordMatchesPatterns(
  record: EspnConferenceRecord | undefined,
  patterns: string[],
): boolean {
  if (!record) return false;

  const fields = [record.name, ...record.aliases];
  return fields.some((field) => patterns.some((pattern) => conferenceTextMatchesPattern(field, pattern)));
}
