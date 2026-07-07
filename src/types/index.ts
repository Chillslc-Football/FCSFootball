export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl?: string;
};

export type Game = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  status: 'scheduled' | 'in_progress' | 'final';
};

export type TeamDivision = 'fcs' | 'fbs';

/** FCS/FBS hint from ESPN team or group metadata — unknown when not present */
export type EspnDivisionHint = TeamDivision | 'unknown';

/** Parsed ESPN link object from scoreboard event.links */
export type EspnLinkCandidate = {
  href: string;
  rel: string[];
  text?: string;
};

/**
 * Normalized ESPN scoreboard game — dev/provider parsing shape.
 * Phase 6E: full event fields without wiring to production screens.
 */
export type EspnNormalizedGame = {
  id: string;
  awayTeam: string;
  awayTeamId?: string;
  awayAbbreviation?: string;
  awayShortDisplayName?: string;
  awayMascot?: string;
  awayLocation?: string;
  awayLogoUrl?: string;
  awayScore?: number;
  awayDivision?: EspnDivisionHint;
  awayConference?: string;
  homeTeam: string;
  homeTeamId?: string;
  homeAbbreviation?: string;
  homeShortDisplayName?: string;
  homeMascot?: string;
  homeLocation?: string;
  homeLogoUrl?: string;
  homeScore?: number;
  homeDivision?: EspnDivisionHint;
  homeConference?: string;
  /** Human-readable ESPN status description */
  status: string;
  /** ESPN status.type.shortDetail — e.g. "9/6 - 12:00 PM EDT" */
  statusShortDetail?: string;
  /** ESPN status.type.detail — e.g. "Sat, September 6th at 12:00 PM EDT" */
  statusDetail?: string;
  /** Mapped internal Game.status when ESPN state is recognized */
  normalizedStatus?: Game['status'];
  startTime: string;
  broadcast?: string;
  /** Primary ESPN web gamecast URL when provided by API */
  espnLink?: string;
  /** ESPN global event uid (e.g. s:20~l:23~e:401866615) — used for app deep links */
  espnUid?: string;
  /** All link objects from the ESPN event payload */
  espnLinkCandidates?: EspnLinkCandidate[];
  /** Venue name and location when ESPN provides it */
  venue?: string;
  /** Raw ESPN group / conference context when available */
  groupInfo?: string;
  /** Core internal Game when required ids + status are present */
  game?: Game;
  /** ESPN curatedRank (1–25) when present — typically FBS AP poll */
  awayEspnCuratedRank?: number;
  homeEspnCuratedRank?: number;
  /** NCAA Top 25 rank when matched from static poll */
  awayRank?: number;
  homeRank?: number;
  awayIsRanked?: boolean;
  homeIsRanked?: boolean;
  /** Season record from ESPN competitor.records (type total), e.g. "8-1" */
  awayRecord?: string;
  homeRecord?: string;
  /** Raw ESPN competitor.records for dev diagnostics */
  awayRecordsRaw?: unknown;
  homeRecordsRaw?: unknown;
};

/** @deprecated Use EspnNormalizedGame */
export type EspnTodayGame = EspnNormalizedGame;

export type GameStatus = 'live' | 'upcoming' | 'final';

export type ScoreboardTeam = {
  id: string;
  /** Compact display name for game cards */
  name: string;
  /** Full ESPN displayName for links and ranking context */
  fullName?: string;
  abbreviation: string;
  logoUrl?: string;
  rank?: number;
  /** Season record, e.g. "8-1" */
  record?: string;
};

export type ScoreboardGame = {
  id: string;
  awayTeam: ScoreboardTeam;
  homeTeam: ScoreboardTeam;
  status: GameStatus;
  awayScore?: number;
  homeScore?: number;
  /** ESPN ISO kickoff — formatted in local timezone at render time */
  startTime?: string;
  /** Quarter/clock for live/final; kickoff fallback when startTime missing */
  statusDetail: string;
  broadcast: string;
  awayRecord?: string;
  homeRecord?: string;
};

export type TeamRecord = {
  wins: number;
  losses: number;
};

/** Positive = moved up, negative = moved down, 0 = unchanged, null = new to poll */
export type PollMovement = number | null;

export type GameLocation = 'home' | 'away' | 'neutral';

export type NextGame = {
  opponent: string;
  date: string;
  time: string;
  location: GameLocation;
  broadcast: string;
};

export type RankedTeam = {
  rank: number;
  team: Team;
  record: TeamRecord;
  pollPoints?: number;
  movement?: PollMovement;
  nextGame?: NextGame;
};

export type NcaaRankingsPayload = {
  pollName: string;
  updatedLabel: string;
  seasonYear?: number;
  week?: number;
  teams: RankedTeam[];
  sourceUrl: string;
  endpoint: string;
  isManualData?: boolean;
  updatedAt?: string;
};

export type ScheduleTeam = {
  id: string;
  /** Compact display name for game cards */
  name: string;
  /** Full ESPN displayName for links and ranking context */
  fullName?: string;
  abbreviation: string;
  logoUrl?: string;
  conference?: string;
  division: TeamDivision;
  rank?: number;
  /** Season record, e.g. "8-1" */
  record?: string;
};

export type ScheduleMatchupType = 'fcs-fcs' | 'fcs-fbs';

export type ScheduleGame = {
  id: string;
  /** ISO date YYYY-MM-DD in local calendar for grouping */
  date: string;
  /** ESPN ISO kickoff — formatted in local timezone at render time */
  startTime?: string;
  /** Legacy/mock display fallback when startTime is unavailable */
  time: string;
  awayTeam: ScheduleTeam;
  homeTeam: ScheduleTeam;
  broadcast: string;
  conference?: string;
  matchupType: ScheduleMatchupType;
  venue?: string;
  status?: GameStatus;
  awayScore?: number;
  homeScore?: number;
  /** Quarter/clock for live/final; kickoff fallback when startTime missing */
  statusDetail?: string;
  awayRecord?: string;
  homeRecord?: string;
};

export type ScheduleWeekId =
  | 'week-0'
  | 'week-1'
  | 'week-2'
  | 'week-3'
  | 'week-4'
  | 'week-5'
  | 'week-6'
  | 'week-7'
  | 'week-8'
  | 'week-9'
  | 'week-10'
  | 'week-11'
  | 'week-12'
  | 'week-13'
  | 'week-14'
  | 'week-15'
  | 'week-16'
  | 'week-17';

export type EspnWeekGamesPayload = {
  weekId: ScheduleWeekId;
  weekLabel: string;
  /** How games were loaded — week query or documented date-range fallback */
  fetchStrategy: 'week_query' | 'date_range';
  fetchNotes: string;
  games: EspnNormalizedGame[];
  endpoint: string;
  raw: Record<string, unknown>;
};

export type UpsetAlertLabel =
  | 'Upset Alert'
  | 'One Score Game'
  | 'FCS Leading'
  | 'FCS Win';

export type UpsetWatchTeam = {
  id: string;
  /** Compact display name for game cards */
  name: string;
  /** Full ESPN displayName for links and ranking context */
  fullName?: string;
  abbreviation: string;
  logoUrl?: string;
  division: TeamDivision;
  rank?: number;
  /** Season record, e.g. "8-1" */
  record?: string;
};

export type UpsetWatchGame = {
  id: string;
  fcsTeam: UpsetWatchTeam;
  fbsTeam: UpsetWatchTeam;
  fcsScore: number;
  fbsScore: number;
  status: 'live' | 'final';
  statusDetail: string;
  alertLabel: UpsetAlertLabel;
  broadcast: string;
  fcsRecord?: string;
  fbsRecord?: string;
};

export type EspnTodayGamesPayload = {
  date: string;
  games: EspnTodayGame[];
  raw: Record<string, unknown>;
  endpoint: string;
};
