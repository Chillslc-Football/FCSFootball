import { parseEspnTeamAbbreviation } from '@/data/providers/espnTeamLogo';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Parsed ESPN team identity from scoreboard competitor.team */
export type ParsedEspnTeamIdentity = {
  /** Full ESPN displayName — used for ranking match and team detail */
  displayName: string;
  shortDisplayName?: string;
  abbreviation?: string;
  /** ESPN team.name — typically the mascot (e.g. Bobcats) */
  mascot?: string;
  /** School/location name without mascot (e.g. Montana State) */
  location?: string;
};

export function parseEspnTeamIdentity(
  team: Record<string, unknown> | undefined,
): ParsedEspnTeamIdentity | null {
  if (!team) return null;

  const displayName =
    asString(team.displayName) ??
    ([asString(team.location), asString(team.name)].filter(Boolean).join(' ') || undefined) ??
    asString(team.name);

  if (!displayName) return null;

  const location = asString(team.location);
  const mascot = asString(team.name);

  return {
    displayName,
    shortDisplayName: asString(team.shortDisplayName),
    abbreviation: parseEspnTeamAbbreviation(team),
    mascot: mascot && mascot !== location ? mascot : undefined,
    location,
  };
}

export function parseEspnTeamIdentityFromUnknown(team: unknown): ParsedEspnTeamIdentity | null {
  return isRecord(team) ? parseEspnTeamIdentity(team) : null;
}
