import {
  CONFERENCE_OPTIONS,
  type ConferenceId,
} from '@/data/conferences/conferenceList';
import {
  lookupEspnConference,
  normalizeConferenceText,
} from '@/data/providers/espnConferenceLookup';

const ESPN_NUMERIC_ID_TO_CONFERENCE_ID: Record<string, ConferenceId> = {
  '1': 'acc',
  '4': 'big-12',
  '5': 'big-ten',
  '8': 'sec',
  '9': 'pac-12',
  '12': 'conference-usa',
  '15': 'mac',
  '17': 'mountain-west',
  '18': 'independents',
  '37': 'sun-belt',
  '151': 'american',
  '20': 'big-sky',
  '21': 'mvfc',
  '24': 'meac',
  '25': 'nec',
  '27': 'patriot',
  '28': 'pioneer',
  '29': 'southern',
  '30': 'southland',
  '31': 'swac',
  '48': 'caa',
  '177': 'united-athletic',
  '179': 'big-south-ovc',
};

function matchConferenceIdFromText(text: string): ConferenceId | undefined {
  const normalized = normalizeConferenceText(text);
  if (!normalized) return undefined;

  for (const option of CONFERENCE_OPTIONS) {
    const labelNorm = normalizeConferenceText(option.label);
    if (normalized === labelNorm) return option.id;
    if (normalized.includes(labelNorm) || labelNorm.includes(normalized)) return option.id;
  }

  return undefined;
}

/** Map a team conference field (ESPN id or display name) to a Conferences tab id. */
export function resolveConferenceId(raw: string | undefined): ConferenceId | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const mapped = ESPN_NUMERIC_ID_TO_CONFERENCE_ID[trimmed];
    if (mapped) return mapped;

    const espnRecord = lookupEspnConference(trimmed);
    if (espnRecord) {
      const fromName = matchConferenceIdFromText(espnRecord.name);
      if (fromName) return fromName;

      for (const alias of espnRecord.aliases) {
        const fromAlias = matchConferenceIdFromText(alias);
        if (fromAlias) return fromAlias;
      }
    }
  }

  return matchConferenceIdFromText(trimmed);
}
