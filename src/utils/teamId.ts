import type { Href } from 'expo-router';

/** URL-safe team key from display name when ESPN teamId is unavailable. */
export function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function isEspnTeamId(key: string): boolean {
  return /^\d+$/.test(key);
}

/** Normalize ESPN numeric team IDs to consistent string form for comparisons. */
export function normalizeEspnTeamId(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const str = String(value).trim();
  return isEspnTeamId(str) ? str : undefined;
}

function isSyntheticFallbackTeamId(teamId: string): boolean {
  return /\d+-(away|home)$/.test(teamId);
}

export function resolveTeamRouteId(teamId: string | undefined, name: string): string {
  if (teamId && isEspnTeamId(teamId)) return teamId;
  if (teamId && !isSyntheticFallbackTeamId(teamId)) return teamId;
  return slugifyTeamName(name);
}

export function buildTeamHref(params: { teamId?: string; name: string }): Href {
  const routeId = resolveTeamRouteId(params.teamId, params.name);
  return `/team/${encodeURIComponent(routeId)}` as Href;
}

export function teamMatchesKey(
  teamId: string | undefined,
  teamName: string,
  key: string,
): boolean {
  const normalizedKey = decodeURIComponent(key).trim().toLowerCase();

  if (isEspnTeamId(normalizedKey)) {
    const normalizedTeamId = normalizeEspnTeamId(teamId);
    return normalizedTeamId === normalizedKey;
  }

  return slugifyTeamName(teamName) === normalizedKey;
}

export function gameIncludesTeamKey(game: {
  awayTeamId?: string;
  awayTeam: string;
  homeTeamId?: string;
  homeTeam: string;
}, teamKey: string): boolean {
  const key = decodeURIComponent(teamKey);
  return (
    teamMatchesKey(game.awayTeamId, game.awayTeam, key) ||
    teamMatchesKey(game.homeTeamId, game.homeTeam, key)
  );
}

export function getTeamSideInGame(
  game: {
    awayTeamId?: string;
    awayTeam: string;
    homeTeamId?: string;
    homeTeam: string;
  },
  teamKey: string,
): 'away' | 'home' | null {
  const key = decodeURIComponent(teamKey);
  if (teamMatchesKey(game.awayTeamId, game.awayTeam, key)) return 'away';
  if (teamMatchesKey(game.homeTeamId, game.homeTeam, key)) return 'home';
  return null;
}
