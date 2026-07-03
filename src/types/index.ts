export type Team = {
  id: string;
  name: string;
  abbreviation: string;
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

/**
 * Normalized ESPN scoreboard game — dev/provider parsing shape.
 * Phase 6E: full event fields without wiring to production screens.
 */
export type EspnNormalizedGame = {
  id: string;
  awayTeam: string;
  awayTeamId?: string;
  awayScore?: number;
  awayDivision?: EspnDivisionHint;
  awayConference?: string;
  homeTeam: string;
  homeTeamId?: string;
  homeScore?: number;
  homeDivision?: EspnDivisionHint;
  homeConference?: string;
  /** Human-readable ESPN status description */
  status: string;
  /** Mapped internal Game.status when ESPN state is recognized */
  normalizedStatus?: Game['status'];
  startTime: string;
  broadcast?: string;
  espnLink?: string;
  /** Venue name and location when ESPN provides it */
  venue?: string;
  /** Raw ESPN group / conference context when available */
  groupInfo?: string;
  /** Core internal Game when required ids + status are present */
  game?: Game;
};

/** @deprecated Use EspnNormalizedGame */
export type EspnTodayGame = EspnNormalizedGame;

export type GameStatus = 'live' | 'upcoming' | 'final';

export type ScoreboardTeam = {
  id: string;
  name: string;
  abbreviation: string;
  rank?: number;
};

export type ScoreboardGame = {
  id: string;
  awayTeam: ScoreboardTeam;
  homeTeam: ScoreboardTeam;
  status: GameStatus;
  awayScore?: number;
  homeScore?: number;
  /** Quarter/clock for live games, start time for upcoming games */
  statusDetail: string;
  broadcast: string;
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

export type ScheduleTeam = {
  id: string;
  name: string;
  abbreviation: string;
  conference?: string;
  division: TeamDivision;
  rank?: number;
};

export type ScheduleMatchupType = 'fcs-fcs' | 'fcs-fbs';

export type ScheduleGame = {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
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
  /** Quarter/clock for live/final; kickoff time for upcoming */
  statusDetail?: string;
};

export type ScheduleWeekId = 'week-0' | 'week-1' | 'week-2';

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
  name: string;
  abbreviation: string;
  division: TeamDivision;
  rank?: number;
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
};

export type EspnTodayGamesPayload = {
  date: string;
  games: EspnTodayGame[];
  raw: Record<string, unknown>;
  endpoint: string;
};
