import type { EspnTodayGame, Game } from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function mapEspnStateToGameStatus(state: string | undefined): Game['status'] | undefined {
  switch (state) {
    case 'pre':
      return 'scheduled';
    case 'in':
      return 'in_progress';
    case 'post':
      return 'final';
    default:
      return undefined;
  }
}

function parseCompetitor(competitor: unknown): {
  homeAway?: string;
  teamId?: string;
  teamName?: string;
  score?: number;
} {
  if (!isRecord(competitor)) return {};

  const team = isRecord(competitor.team) ? competitor.team : undefined;

  return {
    homeAway: asString(competitor.homeAway),
    teamId: team ? asString(team.id) : undefined,
    teamName: team ? asString(team.displayName) ?? asString(team.name) : undefined,
    score: asNumber(competitor.score),
  };
}

function parseBroadcast(competition: Record<string, unknown>): string | undefined {
  const broadcasts = competition.broadcasts;
  if (!Array.isArray(broadcasts)) return undefined;

  for (const entry of broadcasts) {
    if (!isRecord(entry)) continue;
    const names = entry.names;
    if (Array.isArray(names)) {
      const labels = names.filter((n): n is string => typeof n === 'string' && n.length > 0);
      if (labels.length > 0) return labels.join(' / ');
    }
    const media = entry.media;
    if (isRecord(media)) {
      const shortName = asString(media.shortName);
      if (shortName) return shortName;
    }
  }

  return undefined;
}

function parseEspnLink(event: Record<string, unknown>): string | undefined {
  const links = event.links;
  if (!Array.isArray(links)) return undefined;

  for (const link of links) {
    if (!isRecord(link)) continue;
    const href = asString(link.href);
    if (href) return href;
  }

  return undefined;
}

function parseEvent(event: unknown): EspnTodayGame | null {
  if (!isRecord(event)) return null;

  const id = asString(event.id);
  if (!id) return null;

  const competitions = event.competitions;
  if (!Array.isArray(competitions) || competitions.length === 0) return null;

  const competition = competitions[0];
  if (!isRecord(competition)) return null;

  const competitors = competition.competitors;
  if (!Array.isArray(competitors)) return null;

  let awayTeam: string | undefined;
  let homeTeam: string | undefined;
  let awayTeamId: string | undefined;
  let homeTeamId: string | undefined;
  let awayScore: number | undefined;
  let homeScore: number | undefined;

  for (const competitor of competitors) {
    const parsed = parseCompetitor(competitor);
    if (parsed.homeAway === 'away') {
      awayTeam = parsed.teamName;
      awayTeamId = parsed.teamId;
      awayScore = parsed.score;
    } else if (parsed.homeAway === 'home') {
      homeTeam = parsed.teamName;
      homeTeamId = parsed.teamId;
      homeScore = parsed.score;
    }
  }

  if (!awayTeam || !homeTeam) return null;

  const statusObj = isRecord(event.status) ? event.status : undefined;
  const statusType = statusObj && isRecord(statusObj.type) ? statusObj.type : undefined;
  const statusName =
    (statusType && asString(statusType.description)) ??
    (statusType && asString(statusType.name)) ??
    (statusType && asString(statusType.state)) ??
    'Unknown';
  const statusState = statusType ? asString(statusType.state) : undefined;

  const startTime = asString(event.date) ?? 'TBD';
  const broadcast = parseBroadcast(competition);
  const espnLink = parseEspnLink(event);

  const internalStatus = mapEspnStateToGameStatus(statusState);
  const game: Game | undefined =
    awayTeamId && homeTeamId && internalStatus
      ? {
          id,
          awayTeamId,
          homeTeamId,
          scheduledAt: startTime,
          status: internalStatus,
        }
      : undefined;

  return {
    id,
    awayTeam,
    homeTeam,
    awayTeamId,
    homeTeamId,
    awayScore,
    homeScore,
    startTime,
    status: statusName,
    broadcast,
    espnLink,
    game,
  };
}

export function parseEspnScoreboard(raw: unknown): EspnTodayGame[] {
  if (!isRecord(raw)) return [];

  const events = raw.events;
  if (!Array.isArray(events)) return [];

  const games: EspnTodayGame[] = [];
  for (const event of events) {
    const parsed = parseEvent(event);
    if (parsed) games.push(parsed);
  }

  return games;
}

export function extractEspnScoreboardDate(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;

  const day = isRecord(raw.day) ? raw.day : undefined;
  const dayDate = day ? asString(day.date) : undefined;
  if (dayDate) return dayDate.slice(0, 10);

  const leagues = raw.leagues;
  if (Array.isArray(leagues) && leagues.length > 0) {
    const league = leagues[0];
    if (isRecord(league)) {
      const calendar = asString(league.calendarStartDate) ?? asString(league.calendarEndDate);
      if (calendar) return calendar.slice(0, 10);
    }
  }

  const events = raw.events;
  if (Array.isArray(events) && events.length > 0) {
    const first = events[0];
    if (isRecord(first)) {
      const eventDate = asString(first.date);
      if (eventDate) return eventDate.slice(0, 10);
    }
  }

  return undefined;
}

export function toRawRecord(raw: unknown): Record<string, unknown> {
  if (isRecord(raw)) return raw;
  return { value: raw };
}
