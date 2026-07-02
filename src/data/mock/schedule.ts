import type { ScheduleGame } from '@/types';

/** Mock "today" anchor for date navigation */
export const MOCK_SCHEDULE_TODAY = '2025-11-22';

export const MOCK_SCHEDULE_CONFERENCES = [
  'All Conferences',
  'Big Sky',
  'MVFC',
  'CAA',
  'Southern',
  'Southland',
] as const;

export type MockScheduleConference = (typeof MOCK_SCHEDULE_CONFERENCES)[number];

export const MOCK_SCHEDULE_GAMES: ScheduleGame[] = [
  // Friday Nov 21
  {
    id: 'sch-1',
    date: '2025-11-21',
    time: '7:00 PM ET',
    awayTeam: { id: 'nich', name: 'Nicholls', abbreviation: 'NICH', conference: 'Southland', division: 'fcs' },
    homeTeam: { id: 'uiw', name: 'Incarnate Word', abbreviation: 'UIW', conference: 'Southland', division: 'fcs', rank: 4 },
    broadcast: 'ESPN+',
    conference: 'Southland',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-2',
    date: '2025-11-21',
    time: '8:00 PM ET',
    awayTeam: { id: 'tar', name: 'Tarleton State', abbreviation: 'TAR', conference: 'UAC', division: 'fcs', rank: 8 },
    homeTeam: { id: 'utah', name: 'Utah Tech', abbreviation: 'UTU', conference: 'UAC', division: 'fcs', rank: 21 },
    broadcast: 'TBD',
    conference: 'UAC',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-3',
    date: '2025-11-21',
    time: '9:00 PM ET',
    awayTeam: { id: 'weber', name: 'Weber State', abbreviation: 'WEB', conference: 'Big Sky', division: 'fcs', rank: 12 },
    homeTeam: { id: 'wash', name: 'Washington', abbreviation: 'WASH', conference: 'Big Ten', division: 'fbs' },
    broadcast: 'ESPN+',
    conference: 'Big Sky',
    matchupType: 'fcs-fbs',
  },
  // Saturday Nov 22 (today)
  {
    id: 'sch-4',
    date: '2025-11-22',
    time: '12:00 PM ET',
    awayTeam: { id: 'furman', name: 'Furman', abbreviation: 'FUR', conference: 'Southern', division: 'fcs' },
    homeTeam: { id: 'merc', name: 'Mercer', abbreviation: 'MER', conference: 'Southern', division: 'fcs', rank: 6 },
    broadcast: 'Local',
    conference: 'Southern',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-5',
    date: '2025-11-22',
    time: '12:00 PM ET',
    awayTeam: { id: 'unh', name: 'New Hampshire', abbreviation: 'UNH', conference: 'CAA', division: 'fcs', rank: 18 },
    homeTeam: { id: 'rhod', name: 'Rhode Island', abbreviation: 'URI', conference: 'CAA', division: 'fcs', rank: 16 },
    broadcast: 'Local',
    conference: 'CAA',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-6',
    date: '2025-11-22',
    time: '2:00 PM ET',
    awayTeam: { id: 'mtst', name: 'Montana State', abbreviation: 'MTST', conference: 'Big Sky', division: 'fcs', rank: 5 },
    homeTeam: { id: 'mont', name: 'Montana', abbreviation: 'MONT', conference: 'Big Sky', division: 'fcs', rank: 1 },
    broadcast: 'ESPN+',
    conference: 'Big Sky',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-7',
    date: '2025-11-22',
    time: '3:30 PM ET',
    awayTeam: { id: 'sdsu', name: 'South Dakota State', abbreviation: 'SDSU', conference: 'MVFC', division: 'fcs', rank: 3 },
    homeTeam: { id: 'ndsu', name: 'North Dakota State', abbreviation: 'NDSU', conference: 'MVFC', division: 'fcs', rank: 2 },
    broadcast: 'ESPN2',
    conference: 'MVFC',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-8',
    date: '2025-11-22',
    time: '4:00 PM ET',
    awayTeam: { id: 'weber', name: 'Weber State', abbreviation: 'WEB', conference: 'Big Sky', division: 'fcs', rank: 12 },
    homeTeam: { id: 'idst', name: 'Idaho State', abbreviation: 'IDST', conference: 'Big Sky', division: 'fcs', rank: 7 },
    broadcast: 'ESPN+',
    conference: 'Big Sky',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-9',
    date: '2025-11-22',
    time: '5:00 PM ET',
    awayTeam: { id: 'sac', name: 'Sacramento State', abbreviation: 'SAC', conference: 'Big Sky', division: 'fcs', rank: 11 },
    homeTeam: { id: 'ucd', name: 'UC Davis', abbreviation: 'UCD', conference: 'Big Sky', division: 'fcs', rank: 10 },
    broadcast: 'ESPN+',
    conference: 'Big Sky',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-10',
    date: '2025-11-22',
    time: '3:00 PM ET',
    awayTeam: { id: 'aam', name: 'Alabama A&M', abbreviation: 'AAMU', conference: 'SWAC', division: 'fcs', rank: 20 },
    homeTeam: { id: 'jack', name: 'Jackson State', abbreviation: 'JKST', conference: 'SWAC', division: 'fcs' },
    broadcast: 'ESPN2',
    conference: 'SWAC',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-11',
    date: '2025-11-22',
    time: '3:30 PM ET',
    awayTeam: { id: 'mont', name: 'Montana', abbreviation: 'MONT', conference: 'Big Sky', division: 'fcs', rank: 1 },
    homeTeam: { id: 'ore', name: 'Oregon', abbreviation: 'ORE', conference: 'Big Ten', division: 'fbs' },
    broadcast: 'ESPN+',
    conference: 'Big Sky',
    matchupType: 'fcs-fbs',
  },
  // Sunday Nov 23
  {
    id: 'sch-12',
    date: '2025-11-23',
    time: '1:00 PM ET',
    awayTeam: { id: 'elon', name: 'Elon', abbreviation: 'ELON', conference: 'CAA', division: 'fcs', rank: 23 },
    homeTeam: { id: 'tows', name: 'Towson', abbreviation: 'TOWS', conference: 'CAA', division: 'fcs' },
    broadcast: 'Local',
    conference: 'CAA',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-13',
    date: '2025-11-23',
    time: '2:00 PM ET',
    awayTeam: { id: 'vill', name: 'Villanova', abbreviation: 'VILL', conference: 'CAA', division: 'fcs', rank: 14 },
    homeTeam: { id: 'rich', name: 'Richmond', abbreviation: 'RICH', conference: 'CAA', division: 'fcs' },
    broadcast: 'ESPN+',
    conference: 'CAA',
    matchupType: 'fcs-fcs',
  },
  {
    id: 'sch-14',
    date: '2025-11-23',
    time: '4:00 PM ET',
    awayTeam: { id: 'port', name: 'Portland State', abbreviation: 'PSU', conference: 'Big Sky', division: 'fcs' },
    homeTeam: { id: 'nau', name: 'Northern Arizona', abbreviation: 'NAU', conference: 'Big Sky', division: 'fcs', rank: 19 },
    broadcast: 'Local',
    conference: 'Big Sky',
    matchupType: 'fcs-fcs',
  },
];

export function formatScheduleDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function shiftScheduleDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
