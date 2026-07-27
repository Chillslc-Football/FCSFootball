import { parseNcaaRankingsHtml } from '@/data/providers/ncaaRankingsHtmlParser';
import {
  mapNcaaRankingsProxyResponse,
  withRankingsFingerprint,
  type NcaaRankingsProxyResponse,
} from '@/data/providers/ncaaRankingsParser';
import { NCAA_RANKINGS_INVESTIGATION } from '@/data/providers/ncaaRankingsInvestigation';
import type { EspnFetchOptions, NcaaRankingsProvider, ProviderResponse } from '@/data/providers/types';
import { NCAA_FCS_TOP_25_URL } from '@/data/providers/types';
import { mapStaticFcsTop25ToPayload, getStaticFcsTop25File } from '@/data/static/staticRankings';
import type { NcaaRankingsPayload } from '@/types';

export class NcaaRankingsNotConnectedError extends Error {
  readonly reason = 'no_reliable_json_source' as const;

  constructor() {
    super(
      'NCAA Stats Perform FCS Top 25 is not connected yet. ' +
        'No official JSON API was found — rankings require a server-side cache. ' +
        'See src/data/providers/NCAA_RANKINGS_INVESTIGATION.md',
    );
    this.name = 'NcaaRankingsNotConnectedError';
  }
}

export class NcaaRankingsFetchError extends Error {
  readonly causes: string[];

  constructor(causes: string[]) {
    super(`Failed to fetch NCAA FCS Top 25: ${causes.join('; ')}`);
    this.name = 'NcaaRankingsFetchError';
    this.causes = causes;
  }
}

/** Documented JSON endpoint env key — optional proxy ahead of HTML fetch. */
export const NCAA_RANKINGS_PROXY_URL_ENV = 'EXPO_PUBLIC_NCAA_RANKINGS_PROXY_URL';

const FETCH_TIMEOUT_MS = 12_000;

function getProxyUrl(): string | undefined {
  const value = process.env[NCAA_RANKINGS_PROXY_URL_ENV]?.trim();
  return value || undefined;
}

async function fetchText(
  url: string,
  options?: {
    signal?: AbortSignal;
    accept?: string;
    timeoutMs?: number;
  },
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options?.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: options?.accept ?? 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'FCSFootball/1.0 (Expo; FCS Poll Reader)',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener('abort', onAbort);
  }
}

function payloadFromProxy(response: NcaaRankingsProxyResponse): NcaaRankingsPayload {
  const parsed = mapNcaaRankingsProxyResponse(response);
  return withRankingsFingerprint({
    pollName: parsed.pollName || 'Stats Perform FCS Top 25',
    updatedLabel: parsed.updatedLabel,
    seasonYear: parsed.seasonYear,
    week: parsed.week,
    releaseId: parsed.releaseId,
    teams: parsed.teams,
    sourceUrl: NCAA_FCS_TOP_25_URL,
    endpoint: 'proxy://ncaa-rankings',
    officialPublishedAt: parsed.officialPublishedAt,
    updatedAt: parsed.officialPublishedAt?.slice(0, 10),
    suppliedBy: 'ncaa-proxy',
  });
}

function payloadFromHtml(html: string): NcaaRankingsPayload {
  const parsed = parseNcaaRankingsHtml(html);
  return withRankingsFingerprint({
    pollName: parsed.pollName || 'Stats Perform FCS Top 25',
    updatedLabel: parsed.updatedLabel,
    seasonYear: parsed.seasonYear,
    week: parsed.week,
    releaseId: parsed.releaseId,
    teams: parsed.teams,
    sourceUrl: NCAA_FCS_TOP_25_URL,
    endpoint: NCAA_FCS_TOP_25_URL,
    officialPublishedAt: parsed.officialPublishedAt,
    updatedAt: parsed.officialPublishedAt?.slice(0, 10),
    isManualData: false,
    suppliedBy: 'ncaa-html',
  });
}

/** Bundled offline bootstrap — used only when no saved poll exists and live fetch fails. */
export function getStaticNcaaRankingsPayload(): NcaaRankingsPayload {
  return mapStaticFcsTop25ToPayload(getStaticFcsTop25File());
}

/**
 * NCAA Stats Perform FCS Top 25 provider.
 *
 * Primary: live NCAA.com HTML (optional JSON proxy via env).
 * Does not silently replace a saved poll with static data on network failure —
 * callers should keep cached rankings and only use getStaticNcaaRankingsPayload()
 * for first-run bootstrap.
 * The Analyst is not used for poll rankings.
 */
export class NcaaRankingsProviderImpl implements NcaaRankingsProvider {
  readonly id = 'ncaa-rankings' as const;
  readonly displayName = 'NCAA Stats Perform FCS Top 25';
  readonly sourceUrl = NCAA_FCS_TOP_25_URL;
  readonly investigation = NCAA_RANKINGS_INVESTIGATION;

  async getTop25(options?: EspnFetchOptions): Promise<ProviderResponse<NcaaRankingsPayload>> {
    const start = Date.now();
    const errors: string[] = [];

    const proxyUrl = getProxyUrl();
    if (proxyUrl) {
      try {
        const body = await fetchText(proxyUrl, {
          signal: options?.signal,
          accept: 'application/json',
          timeoutMs: options?.timeoutMs,
        });
        const json = JSON.parse(body) as NcaaRankingsProxyResponse;
        if (!Array.isArray(json.data) || json.data.length < 10) {
          throw new Error('Proxy JSON missing rankings data');
        }
        return {
          providerId: this.id,
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
          data: payloadFromProxy(json),
        };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    try {
      const html = await fetchText(NCAA_FCS_TOP_25_URL, {
        signal: options?.signal,
        accept: 'text/html',
        timeoutMs: options?.timeoutMs,
      });
      return {
        providerId: this.id,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        data: payloadFromHtml(html),
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    throw new NcaaRankingsFetchError(errors);
  }
}

export const ncaaRankingsProvider = new NcaaRankingsProviderImpl();
