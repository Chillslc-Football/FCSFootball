/**
 * Map Supabase Auth / transport failures to user-facing Admin sign-in copy.
 * Keeps raw TypeError / AuthRetryableFetchError off the UI.
 */

export type AdminAuthFailurePhase =
  | 'not_configured'
  | 'validation'
  | 'sign_in'
  | 'admin_check'
  | 'unknown';

export function isNetworkAuthFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('authretryablefetcherror') ||
    lower.includes('fetch failed') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('could not connect')
  );
}

export function isInvalidCredentialsFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('wrong email or password') ||
    lower.includes('email not confirmed')
  );
}

export function formatAdminSignInError(
  error: unknown,
  phase: AdminAuthFailurePhase = 'unknown',
): string {
  if (phase === 'not_configured') {
    return 'Supabase is not configured.';
  }
  if (phase === 'validation') {
    return 'Email and password are required.';
  }
  if (phase === 'admin_check') {
    return 'This account does not have administrator access.';
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : '';

  if (isNetworkAuthFailure(message)) {
    return 'Could not reach FCS Pulse services. Check your connection and try again.';
  }
  if (isInvalidCredentialsFailure(message)) {
    return 'Incorrect email or password.';
  }

  // Avoid leaking raw TypeError / stack-like text.
  if (!message || /^typeerror\b/i.test(message) || message === 'Network request failed') {
    return 'Could not reach FCS Pulse services. Check your connection and try again.';
  }

  return message;
}

/** Dev-only structured log — never logs secrets or full URLs with keys. */
export function logAdminAuthFailureDev(input: {
  phase: AdminAuthFailurePhase;
  error: unknown;
  supabaseHost?: string | null;
}): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const message =
    input.error instanceof Error
      ? input.error.message
      : typeof input.error === 'string'
        ? input.error
        : String(input.error);
  console.warn('[adminAuth]', {
    phase: input.phase,
    name: input.error instanceof Error ? input.error.name : undefined,
    message,
    supabaseHost: input.supabaseHost ?? null,
  });
}
