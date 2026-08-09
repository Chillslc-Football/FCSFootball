/**
 * Parse ESPN site-v2 college-football team roster payloads.
 * Endpoint: /apis/site/v2/sports/football/college-football/teams/{id}/roster
 */

export type EspnRosterPlayer = {
  id: string;
  displayName: string;
  jersey?: string;
  positionAbbreviation?: string;
  positionDisplayName?: string;
  classYear?: string;
  height?: string;
  weight?: string;
  hometown?: string;
  headshotUrl?: string;
  espnPlayerUrl?: string;
  statusType?: string;
};

export type EspnRosterPositionGroup = {
  /** Position abbreviation when available, else Other */
  key: string;
  title: string;
  players: EspnRosterPlayer[];
};

export type EspnRosterCategoryGroup = {
  /** ESPN athletes[].position — offense | defense | specialTeam | … */
  key: string;
  title: string;
  positionGroups: EspnRosterPositionGroup[];
};

export type EspnTeamRoster = {
  teamId: string;
  teamName?: string;
  seasonYear?: number;
  groups: EspnRosterCategoryGroup[];
  players: EspnRosterPlayer[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asIdString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

const CATEGORY_TITLES: Record<string, string> = {
  offense: 'Offense',
  defense: 'Defense',
  specialTeam: 'Special Teams',
  specialTeams: 'Special Teams',
  injuredReserveOrOut: 'Injured / Out',
  suspended: 'Suspended',
  practiceSquad: 'Practice Squad',
};

/** Stable scan order within a category. Unknown abbreviations sort after known ones. */
const POSITION_SORT_ORDER = [
  'QB',
  'RB',
  'FB',
  'WR',
  'TE',
  'OL',
  'OT',
  'OG',
  'C',
  'DL',
  'DE',
  'DT',
  'NT',
  'LB',
  'ILB',
  'OLB',
  'DB',
  'CB',
  'S',
  'FS',
  'SS',
  'PK',
  'K',
  'P',
  'LS',
  'ATH',
];

function positionSortIndex(abbreviation: string): number {
  const index = POSITION_SORT_ORDER.indexOf(abbreviation.toUpperCase());
  return index === -1 ? POSITION_SORT_ORDER.length : index;
}

function compareJersey(a?: string, b?: string): number {
  const na = a != null && a !== '' ? Number(a) : Number.POSITIVE_INFINITY;
  const nb = b != null && b !== '' ? Number(b) : Number.POSITIVE_INFINITY;
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true });
}

export function resolveEspnPlayerCardUrl(links: unknown): string | undefined {
  if (!Array.isArray(links)) return undefined;

  for (const entry of links) {
    if (!isRecord(entry)) continue;
    const href = asString(entry.href);
    if (!href || !href.startsWith('http')) continue;
    const rel = Array.isArray(entry.rel)
      ? entry.rel.filter((value): value is string => typeof value === 'string')
      : [];
    if (rel.includes('playercard') && rel.includes('desktop')) {
      return href;
    }
  }

  for (const entry of links) {
    if (!isRecord(entry)) continue;
    const href = asString(entry.href);
    if (!href || !href.startsWith('http')) continue;
    if (href.includes('/college-football/player/_/id/')) {
      return href;
    }
  }

  return undefined;
}

function formatHometown(birthPlace: unknown): string | undefined {
  if (!isRecord(birthPlace)) return undefined;
  const displayText = asString(birthPlace.displayText);
  if (displayText) return displayText;
  const city = asString(birthPlace.city);
  const state = asString(birthPlace.state);
  if (city && state) return `${city}, ${state}`;
  return city ?? state;
}

export function parseEspnRosterAthlete(raw: unknown): EspnRosterPlayer | null {
  if (!isRecord(raw)) return null;
  const id = asIdString(raw.id);
  const displayName =
    asString(raw.displayName) ?? asString(raw.fullName) ?? asString(raw.shortName);
  if (!id || !displayName) return null;

  const position = isRecord(raw.position) ? raw.position : undefined;
  const experience = isRecord(raw.experience) ? raw.experience : undefined;
  const headshot = isRecord(raw.headshot) ? raw.headshot : undefined;
  const status = isRecord(raw.status) ? raw.status : undefined;

  return {
    id,
    displayName,
    jersey: asString(raw.jersey),
    positionAbbreviation: position ? asString(position.abbreviation) : undefined,
    positionDisplayName:
      position
        ? asString(position.displayName) ?? asString(position.name)
        : undefined,
    classYear: experience
      ? asString(experience.displayValue) ?? asString(experience.abbreviation)
      : undefined,
    height: asString(raw.displayHeight),
    weight: asString(raw.displayWeight),
    hometown: formatHometown(raw.birthPlace),
    headshotUrl: headshot ? asString(headshot.href) : undefined,
    espnPlayerUrl: resolveEspnPlayerCardUrl(raw.links),
    statusType: status ? asString(status.type) ?? asString(status.name) : undefined,
  };
}

function sortPlayers(players: EspnRosterPlayer[]): EspnRosterPlayer[] {
  return [...players].sort((a, b) => {
    const posCmp =
      positionSortIndex(a.positionAbbreviation ?? 'ZZZ') -
      positionSortIndex(b.positionAbbreviation ?? 'ZZZ');
    if (posCmp !== 0) return posCmp;
    const jerseyCmp = compareJersey(a.jersey, b.jersey);
    if (jerseyCmp !== 0) return jerseyCmp;
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
  });
}

function groupPlayersByPosition(players: EspnRosterPlayer[]): EspnRosterPositionGroup[] {
  const byKey = new Map<string, EspnRosterPlayer[]>();

  for (const player of players) {
    const key = (player.positionAbbreviation ?? 'Other').toUpperCase();
    const list = byKey.get(key) ?? [];
    list.push(player);
    byKey.set(key, list);
  }

  return [...byKey.entries()]
    .sort((a, b) => positionSortIndex(a[0]) - positionSortIndex(b[0]))
    .map(([key, groupPlayers]) => {
      const title =
        groupPlayers.find((player) => player.positionDisplayName)?.positionDisplayName ??
        (key === 'Other' ? 'Other' : key);
      return {
        key,
        title,
        players: sortPlayers(groupPlayers),
      };
    });
}

/** NFL-style buckets on the college payload — omit for a glanceable FCS roster. */
const SKIP_CATEGORY_KEYS = new Set([
  'injuredReserveOrOut',
  'suspended',
  'practiceSquad',
]);

/**
 * Parse a full ESPN roster JSON document into normalized groups.
 * Preserves ESPN offense/defense/specialTeam categories; subgroups by position.
 */
export function parseEspnTeamRoster(
  raw: unknown,
  fallbackTeamId?: string,
): EspnTeamRoster {
  if (!isRecord(raw)) {
    return {
      teamId: fallbackTeamId ?? '',
      groups: [],
      players: [],
    };
  }

  const team = isRecord(raw.team) ? raw.team : undefined;
  const teamId = asIdString(team?.id) ?? fallbackTeamId ?? '';
  const teamName = asString(team?.displayName) ?? asString(team?.name);
  const season = isRecord(raw.season) ? raw.season : undefined;
  const seasonYear = asNumber(season?.year);

  const athletes = Array.isArray(raw.athletes) ? raw.athletes : [];
  const groups: EspnRosterCategoryGroup[] = [];
  const allPlayers: EspnRosterPlayer[] = [];

  for (const entry of athletes) {
    if (!isRecord(entry)) continue;
    const categoryKey = asString(entry.position) ?? 'other';
    if (SKIP_CATEGORY_KEYS.has(categoryKey)) continue;

    const items = Array.isArray(entry.items) ? entry.items : [];
    const players: EspnRosterPlayer[] = [];

    for (const item of items) {
      const player = parseEspnRosterAthlete(item);
      if (!player) continue;
      // Keep active (and unknown) players; skip explicit inactive.
      if (player.statusType?.toLowerCase() === 'inactive') continue;
      players.push(player);
      allPlayers.push(player);
    }

    if (players.length === 0) continue;

    groups.push({
      key: categoryKey,
      title: CATEGORY_TITLES[categoryKey] ?? categoryKey,
      positionGroups: groupPlayersByPosition(players),
    });
  }

  return {
    teamId,
    teamName,
    seasonYear,
    groups,
    players: allPlayers,
  };
}
