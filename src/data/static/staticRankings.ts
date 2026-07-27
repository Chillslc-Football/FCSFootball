import { withRankingsFingerprint } from '@/data/providers/ncaaRankingsParser';
import type { NcaaRankingsPayload, PollMovement, RankedTeam, TeamRecord } from '@/types';

import fcsTop25Json from './fcsTop25.json';

export type StaticFcsTop25Entry = {
  rank: number;
  teamName: string;
  record: string;
  points?: number;
  previousRank?: number | null;
  movement?: PollMovement;
};

export type StaticFcsTop25File = {
  pollName: string;
  sourceUrl: string;
  updatedAt: string;
  updatedLabel?: string;
  isManualData: true;
  teams: StaticFcsTop25Entry[];
};

function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
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

function parseRecord(record: string): TeamRecord {
  const match = record.match(/^(\d+)\s*-\s*(\d+)/);
  if (!match) return { wins: 0, losses: 0 };
  return { wins: Number(match[1]), losses: Number(match[2]) };
}

function resolveMovement(
  entry: StaticFcsTop25Entry,
): PollMovement {
  if (entry.movement !== undefined) return entry.movement;
  if (entry.previousRank == null) return null;
  return entry.previousRank - entry.rank;
}

/** Bundled static poll file — update manually each week from NCAA.com. */
export function getStaticFcsTop25File(): StaticFcsTop25File {
  return fcsTop25Json as StaticFcsTop25File;
}

export function mapStaticFcsTop25ToPayload(file: StaticFcsTop25File): NcaaRankingsPayload {
  const teams: RankedTeam[] = file.teams.map((entry) => ({
    rank: entry.rank,
    team: {
      id: slugifyTeamName(entry.teamName),
      name: entry.teamName,
      abbreviation: abbreviateTeamName(entry.teamName),
    },
    record: parseRecord(entry.record),
    pollPoints: entry.points,
    movement: resolveMovement(entry),
  }));

  teams.sort((a, b) => a.rank - b.rank || a.team.name.localeCompare(b.team.name));

  const officialPublishedAt = /^\d{4}-\d{2}-\d{2}/.test(file.updatedAt)
    ? `${file.updatedAt.slice(0, 10)}T12:00:00.000Z`
    : undefined;

  return withRankingsFingerprint({
    pollName: file.pollName,
    updatedLabel: file.updatedLabel ?? file.updatedAt,
    teams,
    sourceUrl: file.sourceUrl,
    endpoint: 'static://fcsTop25.json',
    isManualData: true,
    updatedAt: file.updatedAt,
    officialPublishedAt,
    suppliedBy: 'static-fallback',
  });
}
