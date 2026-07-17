import type { EspnNormalizedGame } from '@/types';
import { extractLocalGameDateIso, formatGameDateLabel } from '@/utils/formatGameTime';
import { sortEspnNormalizedGames } from '@/utils/sortGames';

export type ConferenceDateGroup = {
  date: string;
  label: string;
  games: EspnNormalizedGame[];
};

export function groupConferenceGamesByDate(games: EspnNormalizedGame[]): ConferenceDateGroup[] {
  const byDate = new Map<string, EspnNormalizedGame[]>();

  for (const game of games) {
    const dateKey = extractLocalGameDateIso(game.startTime);
    const bucket = byDate.get(dateKey) ?? [];
    bucket.push(game);
    byDate.set(dateKey, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b);
    })
    .map(([date, dateGames]) => ({
      date,
      label: formatGameDateLabel(date),
      games: sortEspnNormalizedGames(dateGames),
    }));
}
