import {
  mapNcaaRankingsProxyResponse,
  type NcaaRankingsParseResult,
} from '@/data/providers/ncaaRankingsParser';

const POLL_NAME = 'Stats Perform FCS Top 25';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '));
}

function extractMetaString(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const patterns = [
      new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'),
      new RegExp(`property=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`content=["']([^"']+)["'][^>]*property=["']${key}["']`, 'i'),
      new RegExp(`name=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`content=["']([^"']+)["'][^>]*name=["']${key}["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return undefined;
}

function normalizeIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function extractUpdatedLabel(html: string): string {
  const throughGames = html.match(/Through Games[^<\n]{0,80}/i)?.[0];
  if (throughGames) return stripTags(throughGames);

  const rankingDate = html.match(/Ranking Date[^<\n:]{0,5}:?\s*([^<\n]{4,60})/i)?.[1];
  if (rankingDate) return `Ranking Date: ${stripTags(rankingDate)}`;

  return 'Stats Perform FCS Top 25';
}

/**
 * Only accept an explicit poll/ranking week label.
 * Do not read generic JSON "week" fields — NCAA.com embeds scoreboard
 * widget weeks (e.g. championship week 18) unrelated to the Top 25 release.
 */
function extractWeek(html: string): number | undefined {
  const patterns = [
    /(?:Stats Perform|FCS Top 25|rankings?)[^.]{0,120}?Week\s+(\d{1,2})\b/i,
    /\bPoll\s+Week\s+(\d{1,2})\b/i,
    /\bRanking\s+Week\s+(\d{1,2})\b/i,
    /"(?:poll_week|ranking_week|rankings_week)"\s*:\s*"?(\d{1,2})"?/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const week = Number(match[1]);
    if (Number.isInteger(week) && week >= 0 && week <= 25) return week;
  }
  return undefined;
}

function extractReleaseId(html: string): string | undefined {
  const nodeId = html.match(/"nid"\s*:\s*"?(\d+)"?/i)?.[1];
  if (nodeId) return `nid:${nodeId}`;
  const uuid = html.match(/"uuid"\s*:\s*"([0-9a-f-]{36})"/i)?.[1];
  if (uuid) return `uuid:${uuid}`;
  return undefined;
}

function extractSeasonYear(html: string, officialPublishedAt?: string): number | undefined {
  const seasonMatch = html.match(/"season"\s*:\s*"?(\d{4})"?/i)?.[1];
  if (seasonMatch) return Number(seasonMatch);
  if (officialPublishedAt) {
    const year = new Date(officialPublishedAt).getUTCFullYear();
    if (!Number.isNaN(year)) return year;
  }
  return undefined;
}

function extractTableHtml(html: string): string | null {
  const rankingsTable = html.match(
    /<table[^>]*class="[^"]*rankings[^"]*"[^>]*>[\s\S]*?<\/table>/i,
  )?.[0];
  if (rankingsTable) return rankingsTable;
  return html.match(/<table[\s\S]*?<\/table>/i)?.[0] ?? null;
}

/**
 * Parse NCAA.com Stats Perform FCS Top 25 HTML into normalized rankings.
 * Prefers structured date_published / date_modified fields when present.
 */
export function parseNcaaRankingsHtml(html: string): NcaaRankingsParseResult & {
  officialPublishedAt?: string;
  releaseId?: string;
} {
  const table = extractTableHtml(html);
  if (!table) {
    throw new Error('NCAA rankings HTML did not contain a rankings table');
  }

  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
  const data: Array<{
    RANK: string;
    SCHOOL: string;
    RECORD: string;
    POINTS?: string;
    PREVIOUS?: string;
  }> = [];

  for (const rowMatch of rows) {
    const cells = [...rowMatch[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      stripTags(cell[1]),
    );
    if (cells.length < 3) continue;

    const rank = cells[0] ?? '';
    const school = cells[1] ?? '';
    const record = cells[2] ?? '';
    if (!/^\s*T?\d+/i.test(rank)) continue;
    if (!school || /^school$/i.test(school)) continue;

    data.push({
      RANK: rank,
      SCHOOL: school,
      RECORD: record,
      POINTS: cells[3],
      PREVIOUS: cells[4],
    });
  }

  if (data.length < 10) {
    throw new Error(`NCAA rankings HTML parse found too few teams (${data.length})`);
  }

  const officialPublishedAt = normalizeIsoDate(
    extractMetaString(html, [
      'date_modified',
      'dateModified',
      'article_modified_time',
      'article:modified_time',
      'date_published',
      'datePublished',
      'article_published_time',
      'article:published_time',
    ]),
  );

  const mapped = mapNcaaRankingsProxyResponse({
    pollName: POLL_NAME,
    updatedLabel: extractUpdatedLabel(html),
    seasonYear: extractSeasonYear(html, officialPublishedAt),
    week: extractWeek(html),
    data,
  });

  return {
    ...mapped,
    officialPublishedAt,
    releaseId: extractReleaseId(html),
  };
}
