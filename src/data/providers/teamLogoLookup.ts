import type { EspnNormalizedGame } from '@/types';

import { normalizeTeamName } from '@/data/providers/teamNameMatch';

export type TeamLogoInfo = {
  logoUrl?: string;
  abbreviation?: string;
  teamId?: string;
};

/** Map normalized ESPN team names to logo metadata from scoreboard games. */
export function buildTeamLogoLookup(games: EspnNormalizedGame[]): Map<string, TeamLogoInfo> {
  const lookup = new Map<string, TeamLogoInfo>();

  function add(
    name: string | undefined,
    logoUrl: string | undefined,
    abbreviation: string | undefined,
    teamId: string | undefined,
  ) {
    if (!name) return;
    const key = normalizeTeamName(name);
    if (!key) return;

    const existing = lookup.get(key);
    lookup.set(key, {
      logoUrl: logoUrl ?? existing?.logoUrl,
      abbreviation: abbreviation ?? existing?.abbreviation,
      teamId: teamId ?? existing?.teamId,
    });
  }

  for (const game of games) {
    add(game.awayTeam, game.awayLogoUrl, game.awayAbbreviation, game.awayTeamId);
    add(game.homeTeam, game.homeLogoUrl, game.homeAbbreviation, game.homeTeamId);
  }

  return lookup;
}

export function lookupTeamLogo(
  teamName: string,
  lookup: Map<string, TeamLogoInfo>,
): TeamLogoInfo | undefined {
  return lookup.get(normalizeTeamName(teamName));
}
