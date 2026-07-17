import {
  CONFERENCE_OPTIONS,
  getAllConferenceMetadata,
  type ConferenceId,
} from '@/data/conferences/conferenceList';
import { resolveConferenceId } from '@/data/conferences/resolveConferenceId';
import {
  conferenceRecordMatchesPatterns,
  conferenceTextMatchesPattern,
  lookupEspnConference,
  normalizeConferenceText,
} from '@/data/providers/espnConferenceLookup';
import type { ScoresLeagueFilterId } from '@/data/providers/types';
import type { EspnNormalizedGame } from '@/types';

/** Text patterns derived from shared conference metadata aliases. */
const CONFERENCE_TEXT_PATTERNS: Record<ConferenceId, string[]> = Object.fromEntries(
  getAllConferenceMetadata().map((entry) => [
    entry.id,
    [
      entry.displayName,
      ...(entry.aliases ?? []),
    ],
  ]),
) as Record<ConferenceId, string[]>;

const CONFERENCE_ESPN_NUMERIC_IDS = new Map<ConferenceId, Set<string>>(
  CONFERENCE_OPTIONS.map((option) => [option.id, new Set<string>()]),
);

for (const entry of getAllConferenceMetadata()) {
  if (!entry.espnGroupId) continue;
  CONFERENCE_ESPN_NUMERIC_IDS.get(entry.id)?.add(entry.espnGroupId);
}

function collectConferenceMatchFields(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  const trimmed = value.trim();
  const fields = [trimmed];

  if (/^\d+$/.test(trimmed)) {
    const record = lookupEspnConference(trimmed);
    if (record) {
      fields.push(record.name, ...record.aliases);
    }
  }

  return fields;
}

function fieldsMatchConferencePatterns(fields: string[], patterns: string[]): boolean {
  for (const field of fields) {
    if (patterns.some((pattern) => conferenceTextMatchesPattern(field, pattern))) {
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

/** True when a team conference field belongs to the selected conference tab id. */
export function teamConferenceMatchesSelected(
  teamConference: string | undefined,
  conferenceId: ConferenceId,
): boolean {
  const trimmed = teamConference?.trim();
  if (!trimmed) return false;

  if (resolveConferenceId(trimmed) === conferenceId) {
    return true;
  }

  if (/^\d+$/.test(trimmed)) {
    const mappedIds = CONFERENCE_ESPN_NUMERIC_IDS.get(conferenceId);
    if (mappedIds?.has(trimmed)) {
      return true;
    }
  }

  const patterns = CONFERENCE_TEXT_PATTERNS[conferenceId];
  if (!patterns?.length) {
    return false;
  }

  return fieldsMatchConferencePatterns(collectConferenceMatchFields(trimmed), patterns);
}

export function gameInvolvesConference(
  game: EspnNormalizedGame,
  conferenceId: ConferenceId,
): boolean {
  return (
    teamConferenceMatchesSelected(game.awayConference, conferenceId) ||
    teamConferenceMatchesSelected(game.homeConference, conferenceId)
  );
}

export function filterEspnGamesByConference(
  games: EspnNormalizedGame[],
  conferenceId: ConferenceId,
): EspnNormalizedGame[] {
  return games.filter((game) => gameInvolvesConference(game, conferenceId));
}

export function resolveConferenceFetchLeague(conferenceId: ConferenceId): ScoresLeagueFilterId {
  const division = CONFERENCE_OPTIONS.find((option) => option.id === conferenceId)?.division;
  return division === 'fbs' ? 'fbs' : 'fcs';
}

/** Normalize conference label for tolerant comparisons. */
export function normalizeConferenceLabel(value: string): string {
  return normalizeConferenceText(value);
}
