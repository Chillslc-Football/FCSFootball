export const ESPN_TRANSPORT_RETRY_DELAY_MS = 750;

export type EspnFetchErrorCode =
  | 'transport'
  | 'timeout'
  | 'cancelled'
  | 'http'
  | 'json'
  | 'other';

export class EspnFetchError extends Error {
  readonly code: EspnFetchErrorCode;

  constructor(message: string, code?: EspnFetchErrorCode) {
    super(message);
    this.name = 'EspnFetchError';
    this.code = code ?? inferEspnFetchErrorCode(message);
  }
}

export function inferEspnFetchErrorCode(message: string): EspnFetchErrorCode {
  if (/timed out/i.test(message)) return 'timeout';
  if (/cancelled/i.test(message)) return 'cancelled';
  if (/status \d+/i.test(message)) return 'http';
  if (/not valid JSON/i.test(message)) return 'json';
  if (
    /Network request failed|Failed to fetch|NetworkError|ESPN fetch failed:|Couldn't load ESPN data/i.test(
      message,
    )
  ) {
    return 'transport';
  }
  return 'other';
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * True only for flaky transport failures worth a single retry.
 * Uses EspnFetchError.code when present so production-safe copy still retries.
 */
export function isEspnTransportFailure(err: unknown): boolean {
  if (err instanceof EspnFetchError) {
    return err.code === 'transport';
  }

  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return false;
  return inferEspnFetchErrorCode(err.message) === 'transport';
}

export function formatEspnFetchError(err: unknown, timeoutMs: number): EspnFetchError {
  if (err instanceof EspnFetchError) {
    return err;
  }

  if (isAbortError(err)) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return new EspnFetchError(
        `ESPN fetch timed out after ${timeoutMs / 1000} seconds. ESPN may be blocking Expo Go or the network is unavailable.`,
        'timeout',
      );
    }
    return new EspnFetchError(
      'ESPN request timed out. Check your connection and try again.',
      'timeout',
    );
  }

  const rawMessage = err instanceof Error ? err.message : 'Network request failed';

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return new EspnFetchError(
      `ESPN fetch failed: ${rawMessage}. Check network access in Expo Go.`,
      'transport',
    );
  }

  return new EspnFetchError(
    "Couldn't load ESPN data. Check your connection and try again.",
    'transport',
  );
}

export function formatScoresLoadError(err: unknown): string {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return err instanceof Error ? err.message : 'Could not load scores from ESPN.';
  }
  return "Scores couldn't be loaded. Check your connection and try again.";
}

export async function withEspnTransportRetry<T>(
  run: () => Promise<T>,
  options?: {
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isEspnTransportFailure(err)) {
      throw err;
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[ESPN] Transport failure; retrying once');
    }

    const delayMs = options?.delayMs ?? ESPN_TRANSPORT_RETRY_DELAY_MS;
    const sleep =
      options?.sleep ??
      ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    await sleep(delayMs);
    return run();
  }
}
