import { MOCK_SCHEDULE_GAMES, MOCK_SCHEDULE_TODAY } from '@/data/mock/schedule';
import type { EspnScoresProvider, ProviderResponse } from '@/data/providers/types';
import type { EspnTodayGame, EspnTodayGamesPayload, EspnWeekGamesPayload, ScheduleWeekId } from '@/types';

const MOCK_DELAY_MS = 750;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRawEspnPayload(date: string, games: EspnTodayGame[]): Record<string, unknown> {
  return {
    source: 'espn-mock',
    endpoint: '/scoreboard',
    date,
    events: games.map((game) => ({
      id: game.id,
      date: game.startTime,
      status: { type: { name: game.status } },
      broadcasts: game.broadcast ? [{ names: [game.broadcast] }] : [],
      competitions: [
        {
          competitors: [
            { homeAway: 'away', team: { displayName: game.awayTeam } },
            { homeAway: 'home', team: { displayName: game.homeTeam } },
          ],
        },
      ],
    })),
  };
}

function parseTodayGames(): EspnTodayGame[] {
  return MOCK_SCHEDULE_GAMES.filter((g) => g.date === MOCK_SCHEDULE_TODAY).map((game) => ({
    id: `espn-${game.id}`,
    awayTeam: game.awayTeam.name,
    homeTeam: game.homeTeam.name,
    startTime: `${game.date}T${game.time.replace(' ET', '')}`,
    status: 'scheduled',
    broadcast: game.broadcast,
  }));
}

export class MockEspnScoresProvider implements EspnScoresProvider {
  readonly id = 'espn-scores' as const;
  readonly displayName = 'ESPN Scores & Schedule (Mock)';

  async getTodayGames(_options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<
    ProviderResponse<EspnTodayGamesPayload>
  > {
    const start = Date.now();
    await delay(MOCK_DELAY_MS);

    const games = parseTodayGames();
    const payload: EspnTodayGamesPayload = {
      date: MOCK_SCHEDULE_TODAY,
      games,
      raw: buildRawEspnPayload(MOCK_SCHEDULE_TODAY, games),
      endpoint: 'mock://espn/scoreboard?groups=81',
    };

    return {
      providerId: this.id,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      data: payload,
    };
  }

  async getWeekGames(
    weekId: ScheduleWeekId,
    _options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<ProviderResponse<EspnWeekGamesPayload>> {
    const start = Date.now();
    await delay(MOCK_DELAY_MS);

    const payload: EspnWeekGamesPayload = {
      weekId,
      weekLabel: weekId,
      fetchStrategy: 'week_query',
      fetchNotes: 'Mock provider — no week games.',
      games: [],
      endpoint: 'mock://espn/scoreboard/week',
      raw: { source: 'espn-mock' },
    };

    return {
      providerId: this.id,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      data: payload,
    };
  }
}

export const mockEspnScoresProvider = new MockEspnScoresProvider();

/** @deprecated Use mockEspnScoresProvider */
export const mockEspnProvider = mockEspnScoresProvider;

/** @deprecated Use MockEspnScoresProvider */
export const MockEspnProvider = MockEspnScoresProvider;
