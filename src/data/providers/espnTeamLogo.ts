/** Standard ESPN NCAA team logo URL when API omits logos array. */
export function buildEspnTeamLogoUrl(teamId: string | undefined): string | undefined {
  if (!teamId) return undefined;
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asIdString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return undefined;
}

/** Pick best logo href from ESPN team.logos — prefers full/default rel. */
export function parseEspnTeamLogoUrl(team: Record<string, unknown> | undefined): string | undefined {
  if (!team) return undefined;

  const logos = team.logos;
  if (Array.isArray(logos)) {
    let fallback: string | undefined;

    for (const entry of logos) {
      if (!isRecord(entry)) continue;
      const href = asString(entry.href);
      if (!href) continue;

      const rel = Array.isArray(entry.rel)
        ? entry.rel.filter((value): value is string => typeof value === 'string')
        : [];

      if (rel.includes('full') && rel.includes('default')) {
        return href;
      }

      fallback ??= href;
    }

    if (fallback) return fallback;
  }

  return buildEspnTeamLogoUrl(asIdString(team.id));
}

export function parseEspnTeamAbbreviation(team: Record<string, unknown> | undefined): string | undefined {
  if (!team) return undefined;

  return asString(team.abbreviation) ?? undefined;
}
