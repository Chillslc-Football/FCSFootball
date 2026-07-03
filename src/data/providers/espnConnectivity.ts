import { ESPN_FETCH_TIMEOUT_MS, EspnFetchError } from '@/data/providers/espnFetch';
import type { FetchWithTimeoutOptions } from '@/data/providers/espnFetch';
import { ESPN_FCS_SCOREBOARD_URL } from '@/data/providers/espnProvider';

export type EspnConnectivityResult = {
  url: string;
  httpStatus: number | null;
  success: boolean;
  durationMs: number;
  responseSizeBytes: number;
  bodyPreview: string;
  /** Parsed JSON body when HTTP 200 and body is valid JSON */
  rawJson?: unknown;
  error?: string;
};

const BODY_PREVIEW_LENGTH = 500;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export { formatSize as formatEspnResponseSize };

/**
 * Raw HTTP connectivity test — no scoreboard parsing.
 * Phase 6C: prove the app can reach ESPN.
 */
export async function testEspnConnectivity(
  url: string = ESPN_FCS_SCOREBOARD_URL,
  { signal, timeoutMs = ESPN_FETCH_TIMEOUT_MS }: FetchWithTimeoutOptions = {},
): Promise<EspnConnectivityResult> {
  const start = Date.now();
  console.log('[ESPN Connectivity] fetch started', url);

  if (signal?.aborted) {
    console.log('[ESPN Connectivity] fetch cancelled');
    throw new EspnFetchError('Request was cancelled.');
  }

  const abortController = new AbortController();

  return new Promise<EspnConnectivityResult>((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const finish = (result: EspnConnectivityResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onExternalAbort);
      abortController.abort();
      resolve(result);
    };

    const onExternalAbort = () => {
      console.log('[ESPN Connectivity] fetch cancelled');
      finish({
        url,
        httpStatus: null,
        success: false,
        durationMs: Date.now() - start,
        responseSizeBytes: 0,
        bodyPreview: '',
        error: 'Request was cancelled.',
      });
    };

    signal?.addEventListener('abort', onExternalAbort);

    const timeoutError = new EspnFetchError(
      `ESPN fetch timed out after ${timeoutMs / 1000} seconds. ESPN may be blocking Expo Go or the network is unavailable.`,
    );

    timeoutId = setTimeout(() => {
      console.log('[ESPN Connectivity] fetch timeout');
      abortController.abort();
      finish({
        url,
        httpStatus: null,
        success: false,
        durationMs: Date.now() - start,
        responseSizeBytes: 0,
        bodyPreview: '',
        error: timeoutError.message,
      });
    }, timeoutMs);

    const runFetch = async (): Promise<EspnConnectivityResult> => {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: abortController.signal,
      });

      const bodyText = await response.text();
      const responseSizeBytes = new TextEncoder().encode(bodyText).length;
      const durationMs = Date.now() - start;
      const success = response.status === 200;

      let rawJson: unknown | undefined;
      if (success) {
        try {
          rawJson = JSON.parse(bodyText) as unknown;
        } catch {
          rawJson = undefined;
        }
      }

      if (success) {
        console.log('[ESPN Connectivity] fetch success HTTP', response.status);
      } else {
        console.log('[ESPN Connectivity] fetch error HTTP', response.status);
      }

      return {
        url,
        httpStatus: response.status,
        success,
        durationMs,
        responseSizeBytes,
        bodyPreview: bodyText.slice(0, BODY_PREVIEW_LENGTH),
        rawJson,
        error: success ? undefined : `HTTP ${response.status} ${response.statusText}`,
      };
    };

    Promise.race([
      runFetch(),
      new Promise<EspnConnectivityResult>((raceResolve) => {
        setTimeout(() => {
          raceResolve({
            url,
            httpStatus: null,
            success: false,
            durationMs: Date.now() - start,
            responseSizeBytes: 0,
            bodyPreview: '',
            error: timeoutError.message,
          });
        }, timeoutMs);
      }),
    ])
      .then((result) => {
        if (result.error?.includes('timed out')) {
          console.log('[ESPN Connectivity] fetch timeout');
        }
        finish(result);
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : 'Network request failed';
        console.log('[ESPN Connectivity] fetch error', message);
        finish({
          url,
          httpStatus: null,
          success: false,
          durationMs: Date.now() - start,
          responseSizeBytes: 0,
          bodyPreview: '',
          error: message,
        });
      });
  });
};
