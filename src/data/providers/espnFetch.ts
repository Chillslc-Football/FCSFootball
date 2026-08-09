import {
  EspnFetchError,
  formatEspnFetchError,
  withEspnTransportRetry,
} from '@/data/providers/espnFetchErrors';

export const ESPN_FETCH_TIMEOUT_MS = 8_000;

export type FetchWithTimeoutOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * When true (default), one extra attempt after a transport/network failure.
   * Does not retry timeouts, cancellations, HTTP status, or JSON errors.
   */
  transportRetryOnce?: boolean;
};

export { EspnFetchError } from '@/data/providers/espnFetchErrors';
export type { EspnFetchErrorCode } from '@/data/providers/espnFetchErrors';
export {
  ESPN_TRANSPORT_RETRY_DELAY_MS,
  formatEspnFetchError,
  formatScoresLoadError,
  isEspnTransportFailure,
  withEspnTransportRetry,
} from '@/data/providers/espnFetchErrors';

/**
 * Fetch JSON from ESPN with a hard timeout (Promise.race + AbortController)
 * and optional external abort (cancel).
 */
export async function fetchEspnJson<T = unknown>(
  url: string,
  {
    signal,
    timeoutMs = ESPN_FETCH_TIMEOUT_MS,
    transportRetryOnce = true,
  }: FetchWithTimeoutOptions = {},
): Promise<T> {
  const runOnce = () => fetchEspnJsonOnce<T>(url, { signal, timeoutMs });

  if (!transportRetryOnce) {
    return runOnce();
  }

  return withEspnTransportRetry(runOnce);
}

async function fetchEspnJsonOnce<T>(
  url: string,
  { signal, timeoutMs = ESPN_FETCH_TIMEOUT_MS }: FetchWithTimeoutOptions,
): Promise<T> {
  console.log('[ESPN Provider] fetch started', url);

  if (signal?.aborted) {
    console.log('[ESPN Provider] fetch cancelled');
    throw new EspnFetchError('Request was cancelled.', 'cancelled');
  }

  const abortController = new AbortController();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const finish = (result: { ok: true; data: T } | { ok: false; err: EspnFetchError }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onExternalAbort);
      abortController.abort();

      if (result.ok) {
        console.log('[ESPN Provider] fetch success');
        resolve(result.data);
        return;
      }

      const { err } = result;
      if (err.message.includes('timed out')) {
        console.log('[ESPN Provider] fetch timeout');
      } else if (err.message.includes('cancelled')) {
        console.log('[ESPN Provider] fetch cancelled');
      } else {
        console.log('[ESPN Provider] fetch error', err.message);
      }
      reject(err);
    };

    const onExternalAbort = () => {
      finish({ ok: false, err: new EspnFetchError('Request was cancelled.', 'cancelled') });
    };

    signal?.addEventListener('abort', onExternalAbort);

    const timeoutMessage =
      typeof __DEV__ !== 'undefined' && __DEV__
        ? `ESPN fetch timed out after ${timeoutMs / 1000} seconds. ESPN may be blocking Expo Go or the network is unavailable.`
        : 'ESPN request timed out. Check your connection and try again.';

    const timeoutError = new EspnFetchError(timeoutMessage, 'timeout');

    const runFetch = async (): Promise<T> => {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new EspnFetchError(
          `ESPN request failed with status ${response.status}. The API may be blocking this client.`,
          'http',
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new EspnFetchError('ESPN response was not valid JSON.', 'json');
      }
    };

    // Hard timeout — always settles even if fetch ignores AbortController in Expo Go.
    timeoutId = setTimeout(() => {
      finish({ ok: false, err: timeoutError });
    }, timeoutMs);

    // Promise.race as a second guard against hung fetch promises.
    Promise.race([
      runFetch(),
      new Promise<never>((_, raceReject) => {
        setTimeout(() => raceReject(timeoutError), timeoutMs);
      }),
    ])
      .then((data) => finish({ ok: true, data }))
      .catch((err) => finish({ ok: false, err: formatEspnFetchError(err, timeoutMs) }));
  });
}
