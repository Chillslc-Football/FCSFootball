import type { ConferenceStandingEntry } from '@/types';

/**
 * Stable partition: favorite teams first, then all others.
 * Preserves relative order within each group. Does not mutate input.
 */
export function sortConferenceStandingsByFavorites(
  entries: ConferenceStandingEntry[],
  isFavorite: (teamId?: string, teamName?: string, abbreviation?: string) => boolean,
): ConferenceStandingEntry[] {
  const favorites: ConferenceStandingEntry[] = [];
  const others: ConferenceStandingEntry[] = [];

  for (const entry of entries) {
    if (isFavorite(entry.teamId, entry.displayName, entry.abbreviation)) {
      favorites.push(entry);
    } else {
      others.push(entry);
    }
  }

  return [...favorites, ...others];
}
