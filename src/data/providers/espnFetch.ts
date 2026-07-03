export const ESPN_FETCH_TIMEOUT_MS = 10_000;

export type FetchWithTimeoutOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class EspnFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EspnFetchError';
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Fetch JSON from ESPN with a hard timeout and optional external abort (cancel).
 */
export async function fetchEspnJson<T = unknown>(
  url: string,
  { signal, timeoutMs = ESPN_FETCH_TIMEOUT_MS }: FetchWithTimeoutOptions = {},
): Promise<T> {
  console.log('[ESPN Provider] GET', url);

  if (signal?.aborted) {
    throw new EspnFetchError('Request was cancelled.');
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[ESPN Provider] Request timed out after', timeoutMs, 'ms');
    timeoutController.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    console.warn('[ESPN Provider] Request cancelled by caller');
    timeoutController.abort();
  };
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw new EspnFetchError(
        `ESPN request failed with status ${response.status}. The API may be blocking this client.`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new EspnFetchError('ESPN response was not valid JSON.');
    }
  } catch (err) {
    if (signal?.aborted) {
      throw new EspnFetchError('Request was cancelled.');
    }

    if (timeoutController.signal.aborted) {
      throw new EspnFetchError(
        `ESPN fetch timed out after ${timeoutMs / 1000} seconds. ESPN may be blocking Expo Go or the network is unavailable.`,
      );
    }

    if (isAbortError(err)) {
      throw new EspnFetchError(
        `ESPN fetch timed out after ${timeoutMs / 1000} seconds. ESPN may be blocking Expo Go or the network is unavailable.`,
      );
    }

    if (err instanceof EspnFetchError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new EspnFetchError(
      `ESPN fetch failed: ${message}. Check network access in Expo Go.`,
    );
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
