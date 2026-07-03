import type { EspnNormalizedGame } from '@/types';

export type CompactTeamNameSource = {
  shortDisplayName?: string;
  abbreviation?: string;
  /** Full ESPN displayName */
  displayName: string;
};

/** Compact label priority: shortDisplayName → abbreviation → displayName */
export function getCompactTeamDisplayName(source: CompactTeamNameSource): string {
  const short = source.shortDisplayName?.trim();
  if (short) return short;

  const abbreviation = source.abbreviation?.trim();
  if (abbreviation) return abbreviation;

  return source.displayName.trim();
}

export function getAwayCompactName(game: EspnNormalizedGame): string {
  return getCompactTeamDisplayName({
    shortDisplayName: game.awayShortDisplayName,
    abbreviation: game.awayAbbreviation,
    displayName: game.awayTeam,
  });
}

export function getHomeCompactName(game: EspnNormalizedGame): string {
  return getCompactTeamDisplayName({
    shortDisplayName: game.homeShortDisplayName,
    abbreviation: game.homeAbbreviation,
    displayName: game.homeTeam,
  });
}

export type TeamDetailHeading = {
  title: string;
  mascot?: string;
};

/** Team detail page — full school name with mascot when available. */
export function getTeamDetailHeading(profile: {
  displayName: string;
  location?: string;
  mascot?: string;
}): TeamDetailHeading {
  const title = profile.location?.trim() || profile.displayName.trim();
  const mascot = profile.mascot?.trim();

  if (!mascot || title.toLowerCase().includes(mascot.toLowerCase())) {
    return { title: profile.displayName.trim() || title };
  }

  return { title, mascot };
}

/** Append ESPN season record beside a team name, e.g. "Montana St (8-1)". */
export function formatTeamNameWithRecord(name: string, record?: string): string {
  const trimmed = record?.trim();
  if (!trimmed) return name;
  return `${name} (${trimmed})`;
}
