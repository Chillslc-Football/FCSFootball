import type { ConferenceId } from '@/data/conferences/conferenceList';
import { getAllConferenceMetadata, getConferenceEspnGroupId } from '@/data/conferences/conferenceList';

/** ESPN standings/scoreboard group id per Conferences tab conference. */
export const CONFERENCE_ESPN_GROUP_IDS: Partial<Record<ConferenceId, string>> = Object.fromEntries(
  getAllConferenceMetadata()
    .filter((entry) => entry.espnGroupId)
    .map((entry) => [entry.id, entry.espnGroupId!]),
) as Partial<Record<ConferenceId, string>>;

export function resolveConferenceEspnGroupId(conferenceId: ConferenceId): string | undefined {
  return getConferenceEspnGroupId(conferenceId) ?? CONFERENCE_ESPN_GROUP_IDS[conferenceId];
}
