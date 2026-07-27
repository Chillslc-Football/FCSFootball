/**
 * Development-only diagnostics for FCS Poll refresh flows.
 * No-ops in production builds.
 */
export function logPollRefreshDev(details: {
  pollSource: string;
  fetchTrigger: string;
  pollWeekReturned?: number | null;
  officialPublicationDate?: string | null;
  isNewPoll?: boolean;
  hourlyRetryBlocked?: boolean;
  suppliedBy?: 'ncaa-html' | 'ncaa-proxy' | 'static-fallback' | 'cache' | null;
  decisionReason?: string;
  expectedCycleId?: string;
  note?: string;
  error?: unknown;
}): void {
  if (!__DEV__) return;

  console.log('[PollRefresh]', {
    at: new Date().toISOString(),
    pollSource: details.pollSource,
    fetchTrigger: details.fetchTrigger,
    pollWeekReturned: details.pollWeekReturned ?? null,
    officialPublicationDate: details.officialPublicationDate ?? null,
    isNewPoll: details.isNewPoll,
    hourlyRetryBlocked: details.hourlyRetryBlocked ?? false,
    suppliedBy: details.suppliedBy ?? null,
    decisionReason: details.decisionReason,
    expectedCycleId: details.expectedCycleId,
    note: details.note,
    error:
      details.error instanceof Error
        ? details.error.message
        : details.error != null
          ? String(details.error)
          : undefined,
  });
}
