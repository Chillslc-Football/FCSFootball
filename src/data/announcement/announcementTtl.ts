/** Home announcement cache TTL — lightweight, not tied to live scores. */
export const APP_ANNOUNCEMENT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function isAnnouncementCacheFresh(
  fetchedAt: number,
  nowMs: number = Date.now(),
  ttlMs: number = APP_ANNOUNCEMENT_TTL_MS,
): boolean {
  return nowMs - fetchedAt >= 0 && nowMs - fetchedAt < ttlMs;
}
