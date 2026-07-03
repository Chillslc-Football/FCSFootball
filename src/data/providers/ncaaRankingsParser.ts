import type { PollMovement, RankedTeam, TeamRecord } from '@/types';

/** Row shape from a server-side NCAA rankings proxy (e.g. cached scrape output). */
export type NcaaRankingsProxyRow = {
  RANK: string;
  SCHOOL: string;
  RECORD: string;
  POINTS?: string;
  PREVIOUS?: string;
};

/** Expected JSON contract from a future server-side rankings cache. */
export type NcaaRankingsProxyResponse = {
  pollName: string;
  updatedLabel: string;
  seasonYear?: number;
  week?: number;
  data: NcaaRankingsProxyRow[];
};

export type NcaaRankingsParseResult = {
  pollName: string;
  updatedLabel: string;
  seasonYear?: number;
  week?: number;
  teams: RankedTeam[];
};

function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function parseRankLabel(rankLabel: string): number {
  const digits = rankLabel.replace(/[^0-9]/g, '');
  const parsed = Number(digits);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseRecord(record: string): TeamRecord {
  const match = record.match(/^(\d+)\s*-\s*(\d+)/);
  if (!match) return { wins: 0, losses: 0 };
  return { wins: Number(match[1]), losses: Number(match[2]) };
}

function parseSchoolName(school: string): string {
  return school.replace(/\s*\(\d+\)\s*$/, '').trim();
}

function abbreviateTeamName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase();
  return parts
    .map((p) => p[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
}

function parsePreviousRank(previous: string | undefined): PollMovement {
  if (!previous) return null;
  const trimmed = previous.trim().toUpperCase();
  if (trimmed === 'NR' || trimmed === '—' || trimmed === '-') return null;
  const parsed = Number(trimmed.replace(/[^0-9]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
}

function computeMovement(currentRank: number, previousRank: PollMovement): PollMovement {
  if (previousRank === null) return null;
  return previousRank - currentRank;
}

function parsePollPoints(points: string | undefined): number | undefined {
  if (!points) return undefined;
  const parsed = Number(points.replace(/[^0-9]/g, ''));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Maps server-side proxy JSON to normalized RankedTeam objects.
 * Used when a rankings cache service is deployed — not called from mobile HTML scrape.
 */
export function mapNcaaRankingsProxyResponse(
  response: NcaaRankingsProxyResponse,
): NcaaRankingsParseResult {
  const teams: RankedTeam[] = [];

  for (const row of response.data) {
    const rank = parseRankLabel(row.RANK);
    if (rank <= 0) continue;

    const name = parseSchoolName(row.SCHOOL);
    const previousRank = parsePreviousRank(row.PREVIOUS);

    teams.push({
      rank,
      team: {
        id: slugifyTeamName(name),
        name,
        abbreviation: abbreviateTeamName(name),
      },
      record: parseRecord(row.RECORD),
      pollPoints: parsePollPoints(row.POINTS),
      movement: computeMovement(rank, previousRank),
    });
  }

  teams.sort((a, b) => a.rank - b.rank);

  return {
    pollName: response.pollName,
    updatedLabel: response.updatedLabel,
    seasonYear: response.seasonYear,
    week: response.week,
    teams,
  };
}
