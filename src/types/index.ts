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
