import type { ConferenceStandingEntry } from '@/types';

function compareTeamNameAlphabetical(
  a: ConferenceStandingEntry,
  b: ConferenceStandingEntry,
): number {
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

/** Favorites first, then alphabetical within each group. Does not mutate input. */
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

  favorites.sort(compareTeamNameAlphabetical);
  others.sort(compareTeamNameAlphabetical);

  return [...favorites, ...others];
}
