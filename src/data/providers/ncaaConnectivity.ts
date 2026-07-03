import { NCAA_FCS_TOP_25_URL } from '@/data/providers/types';

export const NCAA_RANKINGS_FETCH_TIMEOUT_MS = 8_000;

export type NcaaRankingsReachabilityResult = {
  url: string;
  httpStatus: number | null;
  ok: boolean;
  contentType: string | null;
  contentLength: number | null;
  durationMs: number;
  error?: string;
  /** True when response looks like HTML (expected for NCAA rankings page). */
  isHtml: boolean;
};

/**
 * Dev-only reachability check — HTTP HEAD/GET metadata only.
 * Does NOT parse rankings or scrape table data in the mobile app.
 */
export async function testNcaaRankingsPageReachability(
  signal?: AbortSignal,
): Promise<NcaaRankingsReachabilityResult> {
  const start = Date.now();
  const url = NCAA_FCS_TOP_25_URL;

  if (signal?.aborted) {
    return {
      url,
      httpStatus: null,
      ok: false,
      contentType: null,
      contentLength: null,
      durationMs: 0,
      error: 'Cancelled',
      isHtml: false,
    };
  }

  const timeoutController = new AbortController();
  const onAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onAbort);
  const timeoutId = setTimeout(() => timeoutController.abort(), NCAA_RANKINGS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html',
        'User-Agent': 'FCSFootball/1.0 (developer reachability probe)',
      },
      signal: timeoutController.signal,
    });

    const contentType = response.headers.get('content-type');
    const contentLengthHeader = response.headers.get('content-length');
    const isHtml = (contentType ?? '').includes('text/html');

    return {
      url,
      httpStatus: response.status,
      ok: response.ok,
      contentType,
      contentLength: contentLengthHeader ? Number(contentLengthHeader) : null,
      durationMs: Date.now() - start,
      error: response.ok ? undefined : `HTTP ${response.status}`,
      isHtml,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      url,
      httpStatus: null,
      ok: false,
      contentType: null,
      contentLength: null,
      durationMs: Date.now() - start,
      error: message,
      isHtml: false,
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}
