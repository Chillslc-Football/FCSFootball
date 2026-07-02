import type { ScoreboardGame } from '@/types';

export const MOCK_LIVE_GAMES: ScoreboardGame[] = [
  {
    id: 'live-1',
    awayTeam: { id: 'mtst', name: 'Montana State', abbreviation: 'MTST', rank: 5 },
    homeTeam: { id: 'mont', name: 'Montana', abbreviation: 'MONT', rank: 1 },
    status: 'live',
    awayScore: 17,
    homeScore: 21,
    statusDetail: 'Q4 · 6:12',
    broadcast: 'ESPN+',
  },
  {
    id: 'live-2',
    awayTeam: { id: 'weber', name: 'Weber State', abbreviation: 'WEB', rank: 12 },
    homeTeam: { id: 'idst', name: 'Idaho State', abbreviation: 'IDST', rank: 7 },
    status: 'live',
    awayScore: 10,
    homeScore: 14,
    statusDetail: 'Q3 · 2:45',
    broadcast: 'ESPN+',
  },
  {
    id: 'live-3',
    awayTeam: { id: 'nich', name: 'Nicholls', abbreviation: 'NICH' },
    homeTeam: { id: 'uiw', name: 'Incarnate Word', abbreviation: 'UIW', rank: 4 },
    status: 'live',
    awayScore: 7,
    homeScore: 13,
    statusDetail: 'Q2 · 0:38',
    broadcast: 'ESPN+',
  },
];

export const MOCK_UPCOMING_GAMES: ScoreboardGame[] = [
  {
    id: 'up-1',
    awayTeam: { id: 'sdsu', name: 'South Dakota State', abbreviation: 'SDSU', rank: 3 },
    homeTeam: { id: 'ndsu', name: 'North Dakota State', abbreviation: 'NDSU', rank: 2 },
    status: 'upcoming',
    statusDetail: '3:30 PM ET',
    broadcast: 'ESPN2',
  },
  {
    id: 'up-2',
    awayTeam: { id: 'sac', name: 'Sacramento State', abbreviation: 'SAC', rank: 11 },
    homeTeam: { id: 'ucd', name: 'UC Davis', abbreviation: 'UCD', rank: 10 },
    status: 'upcoming',
    statusDetail: '5:00 PM ET',
    broadcast: 'ESPN+',
  },
  {
    id: 'up-3',
    awayTeam: { id: 'furman', name: 'Furman', abbreviation: 'FUR' },
    homeTeam: { id: 'merc', name: 'Mercer', abbreviation: 'MER', rank: 6 },
    status: 'upcoming',
    statusDetail: '12:00 PM ET',
    broadcast: 'Local',
  },
  {
    id: 'up-4',
    awayTeam: { id: 'tar', name: 'Tarleton State', abbreviation: 'TAR', rank: 8 },
    homeTeam: { id: 'utah', name: 'Utah Tech', abbreviation: 'UTU', rank: 21 },
    status: 'upcoming',
    statusDetail: '8:00 PM ET',
    broadcast: 'TBD',
  },
];

export const MOCK_FINAL_GAMES: ScoreboardGame[] = [
  {
    id: 'fin-1',
    awayTeam: { id: 'vill', name: 'Villanova', abbreviation: 'VILL', rank: 14 },
    homeTeam: { id: 'rich', name: 'Richmond', abbreviation: 'RICH' },
    status: 'final',
    awayScore: 28,
    homeScore: 21,
    statusDetail: 'Final',
    broadcast: 'ESPN+',
  },
  {
    id: 'fin-2',
    awayTeam: { id: 'unh', name: 'New Hampshire', abbreviation: 'UNH', rank: 18 },
    homeTeam: { id: 'rhod', name: 'Rhode Island', abbreviation: 'URI', rank: 16 },
    status: 'final',
    awayScore: 17,
    homeScore: 24,
    statusDetail: 'Final',
    broadcast: 'Local',
  },
  {
    id: 'fin-3',
    awayTeam: { id: 'ysu', name: 'Youngstown State', abbreviation: 'YSU', rank: 13 },
    homeTeam: { id: 'most', name: 'Missouri State', abbreviation: 'MOST' },
    status: 'final',
    awayScore: 31,
    homeScore: 27,
    statusDetail: 'Final',
    broadcast: 'Local',
  },
  {
    id: 'fin-4',
    awayTeam: { id: 'elon', name: 'Elon', abbreviation: 'ELON', rank: 23 },
    homeTeam: { id: 'tows', name: 'Towson', abbreviation: 'TOWS' },
    status: 'final',
    awayScore: 14,
    homeScore: 10,
    statusDetail: 'Final',
    broadcast: 'Local',
  },
];

export const MOCK_SCORES_META = {
  dateLabel: 'Saturday, Nov 22',
  lastUpdated: '2025-11-22T18:30:00',
};
