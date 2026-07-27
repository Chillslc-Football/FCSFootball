/**
 * Development-only diagnostics for ESPN / Polls refresh flows.
 * No-ops in production builds.
 */
export function logEspnRefreshDev(details: {
  source: string;
  screen?: string;
  trigger?: string;
  phase: 'start' | 'success' | 'error' | 'skip' | 'poll-start' | 'poll-stop';
  count?: number;
  activeLiveGames?: number;
  scheduledPollNeeded?: boolean;
  pollWeekId?: string;
  error?: unknown;
  note?: string;
}): void {
  if (!__DEV__) return;

  const prefix = `[ESPNRefresh:${details.source}]`;
  const base = {
    screen: details.screen,
    trigger: details.trigger,
    at: new Date().toISOString(),
  };

  switch (details.phase) {
    case 'start':
      console.log(`${prefix} fetch start`, {
        ...base,
        scheduledPollNeeded: details.scheduledPollNeeded,
        pollWeekId: details.pollWeekId,
        note: details.note,
      });
      return;
    case 'success':
      console.log(`${prefix} fetch complete`, {
        ...base,
        count: details.count,
        pollWeekId: details.pollWeekId,
        note: details.note,
      });
      return;
    case 'skip':
      console.log(`${prefix} fetch skipped`, {
        ...base,
        scheduledPollNeeded: details.scheduledPollNeeded,
        pollWeekId: details.pollWeekId,
        note: details.note,
      });
      return;
    case 'poll-start':
      console.log(`${prefix} live polling start`, {
        ...base,
        activeLiveGames: details.activeLiveGames,
      });
      return;
    case 'poll-stop':
      console.log(`${prefix} live polling stop`, {
        ...base,
        activeLiveGames: details.activeLiveGames,
        note: details.note,
      });
      return;
    case 'error':
      console.warn(`${prefix} fetch error`, {
        ...base,
        error: details.error instanceof Error ? details.error.message : details.error,
        note: details.note,
      });
      return;
    default:
      return;
  }
}
