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

export type TeamDivision = 'fcs' | 'fbs';

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
