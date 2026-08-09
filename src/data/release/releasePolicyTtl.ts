/** Normal release-policy cache TTL (startup + foreground recheck). */
export const APP_RELEASE_POLICY_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours

export function isReleasePolicyCacheFresh(
  fetchedAt: number,
  nowMs: number = Date.now(),
  ttlMs: number = APP_RELEASE_POLICY_TTL_MS,
): boolean {
  return nowMs - fetchedAt >= 0 && nowMs - fetchedAt < ttlMs;
}
