import type { EspnNormalizedGame } from '@/types';

import { resolveCanonicalTeamName } from '@/data/favorites/favoriteTeamMatch';
import { normalizeTeamName } from '@/data/providers/teamNameMatch';
import { FCS_TEAM_ALIASES } from '@/data/static/teamAliases';

export type TeamLogoInfo = {
  logoUrl?: string;
  abbreviation?: string;
  teamId?: string;
};

function mergeLogoInfo(
  existing: TeamLogoInfo | undefined,
  next: TeamLogoInfo,
): TeamLogoInfo {
  return {
    logoUrl: next.logoUrl ?? existing?.logoUrl,
    abbreviation: next.abbreviation ?? existing?.abbreviation,
    teamId: next.teamId ?? existing?.teamId,
  };
}

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

    const info = mergeLogoInfo(lookup.get(key), { logoUrl, abbreviation, teamId });
    lookup.set(key, info);

    // Also index by canonical / poll short name so Polls can resolve ESPN IDs.
    const canonicalKey = normalizeTeamName(resolveCanonicalTeamName(name));
    if (canonicalKey && canonicalKey !== key) {
      lookup.set(canonicalKey, mergeLogoInfo(lookup.get(canonicalKey), info));
    }
  }

  for (const game of games) {
    add(game.awayTeam, game.awayLogoUrl, game.awayAbbreviation, game.awayTeamId);
    add(game.homeTeam, game.homeLogoUrl, game.homeAbbreviation, game.homeTeamId);
  }

  return lookup;
}

/**
 * Resolve logo / ESPN team metadata for a display name.
 * Matches normalized name, alias target, or ESPN "School Mascot" prefix form.
 */
export function lookupTeamLogo(
  teamName: string,
  lookup: Map<string, TeamLogoInfo>,
): TeamLogoInfo | undefined {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return undefined;

  const direct = lookup.get(normalized);
  if (direct) return direct;

  const aliasTarget = FCS_TEAM_ALIASES[normalized];
  if (aliasTarget) {
    const viaAlias = lookup.get(normalizeTeamName(aliasTarget));
    if (viaAlias) return viaAlias;
  }

  const canonicalKey = normalizeTeamName(resolveCanonicalTeamName(teamName));
  if (canonicalKey && canonicalKey !== normalized) {
    const viaCanonical = lookup.get(canonicalKey);
    if (viaCanonical) return viaCanonical;
  }

  for (const [key, info] of lookup) {
    if (key.startsWith(`${normalized} `)) return info;

    const keyAliasTarget = FCS_TEAM_ALIASES[key];
    if (keyAliasTarget && normalizeTeamName(keyAliasTarget) === normalized) {
      return info;
    }
  }

  return undefined;
}
