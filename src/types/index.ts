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
