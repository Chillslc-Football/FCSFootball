import type { EspnDivisionHint, EspnNormalizedGame, Game } from '@/types';

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

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

const FCS_GROUP_IDS = new Set(['81']);
const FBS_GROUP_IDS = new Set(['80']);

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

function divisionFromGroupRecord(group: Record<string, unknown>): EspnDivisionHint | undefined {
  const id = asString(group.id);
  const name = (asString(group.name) ?? asString(group.shortName) ?? '').toLowerCase();

  if (id && FCS_GROUP_IDS.has(id)) return 'fcs';
  if (id && FBS_GROUP_IDS.has(id)) return 'fbs';
  if (name.includes('fcs') || name.includes('i-aa')) return 'fcs';
  if (name.includes('fbs') || name.includes('i-a')) return 'fbs';

  return undefined;
}

function parseTeamDivisionHint(
  team: Record<string, unknown> | undefined,
  eventGroups: unknown,
): EspnDivisionHint {
  if (!team) return 'unknown';

  const teamGroups = team.groups;
  if (Array.isArray(teamGroups)) {
    for (const entry of teamGroups) {
      if (!isRecord(entry)) continue;
      const division = divisionFromGroupRecord(entry);
      if (division) return division;
    }
  }

  if (Array.isArray(eventGroups)) {
    for (const entry of eventGroups) {
      if (!isRecord(entry)) continue;
      const division = divisionFromGroupRecord(entry);
      if (division) return division;
    }
  }

  return 'unknown';
}

function parseTeamConference(team: Record<string, unknown> | undefined): string | undefined {
  if (!team) return undefined;

  const conference = isRecord(team.conference) ? team.conference : undefined;
  if (conference) {
    return (
      asString(conference.name) ??
      asString(conference.shortName) ??
      asString(conference.abbreviation) ??
      asString(conference.id)
    );
  }

  return (
    asString(team.conferenceDisplayName) ??
    asString(team.conferenceId) ??
    undefined
  );
}

function parseCompetitor(competitor: unknown): {
  homeAway?: string;
  teamId?: string;
  teamName?: string;
  score?: number;
  teamRecord?: Record<string, unknown>;
} {
  if (!isRecord(competitor)) return {};

  const team = isRecord(competitor.team) ? competitor.team : undefined;

  return {
    homeAway: asString(competitor.homeAway),
    teamId: team ? asIdString(team.id) : undefined,
    teamName: team ? asString(team.displayName) ?? asString(team.name) : undefined,
    score: asNumber(competitor.score),
    teamRecord: team,
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

function parseVenue(competition: Record<string, unknown>): string | undefined {
  const venue = isRecord(competition.venue) ? competition.venue : undefined;
  if (!venue) return undefined;

  const name = asString(venue.fullName) ?? asString(venue.displayName);
  const address = isRecord(venue.address) ? venue.address : undefined;
  const city = address ? asString(address.city) : undefined;
  const state = address ? asString(address.state) : undefined;
  const location = [city, state].filter(Boolean).join(', ');

  if (name && location) return `${name} · ${location}`;
  return name ?? location ?? undefined;
}

function parseGroupInfo(
  event: Record<string, unknown>,
  competition: Record<string, unknown>,
): string | undefined {
  const parts: string[] = [];

  const eventGroups = event.groups;
  if (Array.isArray(eventGroups)) {
    for (const entry of eventGroups) {
      if (!isRecord(entry)) continue;
      const name = asString(entry.name) ?? asString(entry.shortName);
      const id = asString(entry.id);
      if (name || id) parts.push(`group: ${name ?? id}`);
    }
  }

  const competitionGroups = competition.groups;
  if (Array.isArray(competitionGroups)) {
    for (const entry of competitionGroups) {
      if (!isRecord(entry)) continue;
      const name = asString(entry.name) ?? asString(entry.shortName);
      const id = asString(entry.id);
      if (name || id) parts.push(`competition group: ${name ?? id}`);
    }
  }

  const conference = isRecord(competition.conference) ? competition.conference : undefined;
  if (conference) {
    const confLabel =
      asString(conference.name) ??
      asString(conference.shortName) ??
      asString(conference.abbreviation);
    if (confLabel) parts.push(`competition conference: ${confLabel}`);
  }

  const conferences = competition.conferences;
  if (Array.isArray(conferences)) {
    for (const entry of conferences) {
      if (!isRecord(entry)) continue;
      const name = asString(entry.name) ?? asString(entry.shortName) ?? asString(entry.id);
      if (name) parts.push(`conference: ${name}`);
    }
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function parseEvent(event: unknown): EspnNormalizedGame | null {
  if (!isRecord(event)) return null;

  const id = asIdString(event.id);
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
  let awayDivision: EspnDivisionHint = 'unknown';
  let homeDivision: EspnDivisionHint = 'unknown';
  let awayConference: string | undefined;
  let homeConference: string | undefined;

  const eventGroups = event.groups;

  for (const competitor of competitors) {
    const parsed = parseCompetitor(competitor);
    const division = parseTeamDivisionHint(parsed.teamRecord, eventGroups);
    const conference = parseTeamConference(parsed.teamRecord);
    const side = parsed.homeAway?.toLowerCase();

    if (side === 'away') {
      awayTeam = parsed.teamName;
      awayTeamId = parsed.teamId;
      awayScore = parsed.score;
      awayDivision = division;
      awayConference = conference;
    } else if (side === 'home') {
      homeTeam = parsed.teamName;
      homeTeamId = parsed.teamId;
      homeScore = parsed.score;
      homeDivision = division;
      homeConference = conference;
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
  const venue = parseVenue(competition);
  const groupInfo = parseGroupInfo(event, competition);
  const normalizedStatus = mapEspnStateToGameStatus(statusState);

  const game: Game | undefined =
    awayTeamId && homeTeamId && normalizedStatus
      ? {
          id,
          awayTeamId,
          homeTeamId,
          scheduledAt: startTime,
          status: normalizedStatus,
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
    awayDivision,
    homeDivision,
    awayConference,
    homeConference,
    startTime,
    status: statusName,
    normalizedStatus,
    broadcast,
    espnLink,
    venue,
    groupInfo,
    game,
  };
}

export type ParseFirstEspnGameResult = {
  game: EspnNormalizedGame | null;
  message?: string;
};

export type EspnScoreboardParseResult = {
  games: EspnNormalizedGame[];
  totalEvents: number;
  totalParsed: number;
  message?: string;
};

export type EspnParsedGamesSummary = {
  statusBreakdown: {
    scheduled: number;
    live: number;
    final: number;
    other: number;
  };
  dateRange: { min: string; max: string } | null;
};

/** Status and kickoff date range from parsed normalized games. */
export function summarizeParsedEspnGames(games: EspnNormalizedGame[]): EspnParsedGamesSummary {
  const statusBreakdown = { scheduled: 0, live: 0, final: 0, other: 0 };
  const dateKeys: string[] = [];

  for (const game of games) {
    switch (game.normalizedStatus) {
      case 'scheduled':
        statusBreakdown.scheduled++;
        break;
      case 'in_progress':
        statusBreakdown.live++;
        break;
      case 'final':
        statusBreakdown.final++;
        break;
      default:
        statusBreakdown.other++;
    }

    if (game.startTime && game.startTime !== 'TBD') {
      dateKeys.push(game.startTime.slice(0, 10));
    }
  }

  dateKeys.sort();
  return {
    statusBreakdown,
    dateRange:
      dateKeys.length > 0
        ? { min: dateKeys[0], max: dateKeys[dateKeys.length - 1] }
        : null,
  };
}

/**
 * Parse only the first event from an ESPN scoreboard response.
 * Phase 6D — defensive, single-game extraction for dev testing.
 */
export function parseFirstEspnGame(raw: unknown): ParseFirstEspnGameResult {
  const result = parseEspnScoreboardNormalized(raw);
  if (result.games.length === 0) {
    return {
      game: null,
      message: result.message ?? 'No games returned from ESPN.',
    };
  }
  return { game: result.games[0] };
}

/**
 * Parse all ESPN scoreboard events into normalized game objects.
 * Phase 6E — defensive parsing, skips malformed events.
 */
export function parseEspnScoreboardNormalized(raw: unknown): EspnScoreboardParseResult {
  if (!isRecord(raw)) {
    return {
      games: [],
      totalEvents: 0,
      totalParsed: 0,
      message: 'Response is not a JSON object.',
    };
  }

  const events = raw.events;
  if (!Array.isArray(events)) {
    return {
      games: [],
      totalEvents: 0,
      totalParsed: 0,
      message: 'Response has no events array.',
    };
  }

  if (events.length === 0) {
    return {
      games: [],
      totalEvents: 0,
      totalParsed: 0,
      message: 'ESPN returned zero events for this query',
    };
  }

  const games: EspnNormalizedGame[] = [];
  for (const event of events) {
    const parsed = parseEvent(event);
    if (parsed) games.push(parsed);
  }

  return {
    games,
    totalEvents: events.length,
    totalParsed: games.length,
    message:
      games.length === 0
        ? 'ESPN returned events but parser failed'
        : undefined,
  };
}

export type EspnScoreboardDiagnostics = {
  httpStatus: number | null;
  hasEventsArray: boolean;
  eventsLength: number;
  firstEventId?: string;
  firstEventName?: string;
  firstEventShortName?: string;
  bodyPreview: string;
  message: string;
  firstEventRawPreview?: string;
};

/** Parser diagnostics for ESPN Data Test — explains zero-parse outcomes. */
export function diagnoseEspnScoreboard(
  raw: unknown,
  parseResult: EspnScoreboardParseResult,
  {
    httpStatus,
    bodyPreview,
  }: {
    httpStatus: number | null;
    bodyPreview: string;
  },
): EspnScoreboardDiagnostics {
  const hasEventsArray = isRecord(raw) && Array.isArray(raw.events);
  const events: unknown[] =
    hasEventsArray && isRecord(raw) ? (raw.events as unknown[]) : [];
  const eventsLength = events.length;

  let firstEventId: string | undefined;
  let firstEventName: string | undefined;
  let firstEventShortName: string | undefined;
  let firstEventRawPreview: string | undefined;

  if (eventsLength > 0) {
    const first = events[0];
    if (isRecord(first)) {
      firstEventId = asIdString(first.id);
      firstEventName = asString(first.name);
      firstEventShortName = asString(first.shortName);
      if (parseResult.totalParsed === 0) {
        firstEventRawPreview = JSON.stringify(first, null, 2).slice(0, 4000);
      }
    }
  }

  let message: string;
  if (!hasEventsArray) {
    message = 'Response has no events array';
  } else if (eventsLength === 0) {
    message = 'ESPN returned zero events for this query';
  } else if (parseResult.totalParsed === 0) {
    message = 'ESPN returned events but parser failed';
  } else {
    message = `Parsed ${parseResult.totalParsed} of ${eventsLength} events`;
  }

  return {
    httpStatus,
    hasEventsArray,
    eventsLength,
    firstEventId,
    firstEventName,
    firstEventShortName,
    bodyPreview: bodyPreview.slice(0, 500),
    message,
    firstEventRawPreview,
  };
}

/** @deprecated Use parseEspnScoreboardNormalized */
export function parseEspnScoreboard(raw: unknown): EspnNormalizedGame[] {
  return parseEspnScoreboardNormalized(raw).games;
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
