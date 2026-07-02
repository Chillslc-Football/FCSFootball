import type { Game, Team } from '@/types';

/**
 * Base contract for future data providers (ESPN, NCAA, etc.).
 * Implementations will swap in without changing screen code.
 */
export type DataProvider = {
  getTop25(): Promise<Team[]>;
  getScores(): Promise<Game[]>;
  getSchedule(): Promise<Game[]>;
  getRankings(): Promise<Team[]>;
};
