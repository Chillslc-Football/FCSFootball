import {
  CONFERENCE_OPTIONS,
  matchConferenceIdFromDisplayText,
  type ConferenceId,
} from '@/data/conferences/conferenceList';
import { lookupEspnConference } from '@/data/providers/espnConferenceLookup';

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
  '22': 'ivy-league',
  '32': 'fcs-independents',
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

/** Map a team conference field (ESPN id or display name) to a Conferences tab id. */
export function resolveConferenceId(raw: string | undefined): ConferenceId | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const mapped = ESPN_NUMERIC_ID_TO_CONFERENCE_ID[trimmed];
    if (mapped) return mapped;

    const espnRecord = lookupEspnConference(trimmed);
    if (espnRecord) {
      const fromName = matchConferenceIdFromDisplayText(espnRecord.name);
      if (fromName) return fromName;

      for (const alias of espnRecord.aliases) {
        const fromAlias = matchConferenceIdFromDisplayText(alias);
        if (fromAlias) return fromAlias;
      }
    }
  }

  return matchConferenceIdFromDisplayText(trimmed);
}
