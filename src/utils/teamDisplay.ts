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

export type TeamScheduleCompactNameSource = {
  /** ESPN school/location without mascot (e.g. Montana State) */
  location?: string;
  /** ESPN shortDisplayName (e.g. Montana St, Tarleton) */
  shortDisplayName?: string;
  abbreviation?: string;
  /** Full ESPN displayName (often includes mascot) */
  displayName: string;
};

/** True when a label is a readable school name, not a bare 2–4 letter code. */
export function isReadableScheduleTeamLabel(
  value: string | undefined,
  abbreviation?: string,
): value is string {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  const abbrev = abbreviation?.trim();
  if (abbrev && trimmed.toUpperCase() === abbrev.toUpperCase()) return false;

  // Skip pure codes like "MTST" / "TAR" — keep "Montana St", "Austin Peay".
  if (/^[A-Z0-9]{2,4}$/.test(trimmed)) return false;

  return true;
}

/**
 * Dense Team schedule row label only.
 * Prefers ESPN shortDisplayName, then location (school without mascot), then displayName.
 * Does not use bare abbreviations.
 */
export function getTeamScheduleCompactName(source: TeamScheduleCompactNameSource): string {
  const abbreviation = source.abbreviation?.trim();

  if (isReadableScheduleTeamLabel(source.shortDisplayName, abbreviation)) {
    return source.shortDisplayName.trim();
  }

  if (isReadableScheduleTeamLabel(source.location, abbreviation)) {
    return source.location.trim();
  }

  return source.displayName.trim();
}

export function getAwayTeamScheduleCompactName(game: EspnNormalizedGame): string {
  return getTeamScheduleCompactName({
    location: game.awayLocation,
    shortDisplayName: game.awayShortDisplayName,
    abbreviation: game.awayAbbreviation,
    displayName: game.awayTeam,
  });
}

export function getHomeTeamScheduleCompactName(game: EspnNormalizedGame): string {
  return getTeamScheduleCompactName({
    location: game.homeLocation,
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
